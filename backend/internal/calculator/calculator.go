// Package calculator implements the arithmetic behind the calculator API.
//
// It is a pure domain package: no I/O and no mutable state, so every function
// is safe for concurrent use. Failures are reported as sentinel errors that the
// transport layer maps to its own status codes.
package calculator

import (
	"errors"
	"fmt"
	"maps"
	"math"
	"slices"
	"strconv"
)

// Operation names an arithmetic operation. Its value appears verbatim in API
// paths, so it must stay stable and URL-safe.
type Operation string

// Supported operations.
const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	Sqrt       Operation = "sqrt"
	Percentage Operation = "percentage"
)

// Errors returned by Calculate. They are wrapped with details, so compare them
// with errors.Is.
var (
	ErrUnknownOperation = errors.New("unknown operation")
	ErrOperandCount     = errors.New("wrong number of operands")
	ErrInvalidOperand   = errors.New("operands must be finite numbers")
	ErrDivisionByZero   = errors.New("division by zero")
	ErrNotReal          = errors.New("result is not a real number")
	ErrOverflow         = errors.New("result is out of range")
)

// significantDigits is the precision fractional results are rounded to.
// float64 carries 15–17 significant decimal digits, and 15 is the most that
// survives every decimal → binary → decimal round trip. Rounding there hides
// binary artifacts such as 0.1 + 0.2 = 0.30000000000000004 without inventing
// precision.
const significantDigits = 15

// exactMagnitude is where rounding to 15 significant digits would start to
// drop integer digits (2^50 + 0.5 would come out below 2^50). Values this
// large have at most a few bits of fraction left, so they are returned as is.
const exactMagnitude = 1e15

// spec describes an operation: how many operands it takes and how to apply it.
type spec struct {
	arity int
	apply func(operands []float64) (float64, error)
}

// registry holds every supported operation. Adding one means adding an entry
// here plus its tests; the HTTP routes are generated from Operations.
var registry = map[Operation]spec{
	Add:        binary(add),
	Subtract:   binary(subtract),
	Multiply:   binary(multiply),
	Divide:     binary(divide),
	Power:      binary(power),
	Sqrt:       unary(sqrt),
	Percentage: binary(percentage),
}

// Operations returns the supported operations in alphabetical order.
func Operations() []Operation {
	return slices.Sorted(maps.Keys(registry))
}

// Calculate applies op to operands. Fractional results below 1e15 are rounded
// to 15 significant digits; everything else, including every integer, is
// returned as computed. The result is always finite and never negative zero.
func Calculate(op Operation, operands ...float64) (float64, error) {
	s, ok := registry[op]
	if !ok {
		return 0, fmt.Errorf("%w %q", ErrUnknownOperation, op)
	}
	if len(operands) != s.arity {
		return 0, fmt.Errorf("%w: %s takes %d, got %d", ErrOperandCount, op, s.arity, len(operands))
	}
	for _, x := range operands {
		if math.IsNaN(x) || math.IsInf(x, 0) {
			return 0, fmt.Errorf("%w, got %v", ErrInvalidOperand, x)
		}
	}
	result, err := s.apply(operands)
	if err != nil {
		return 0, err
	}
	return normalize(result)
}

func unary(f func(x float64) (float64, error)) spec {
	return spec{arity: 1, apply: func(x []float64) (float64, error) { return f(x[0]) }}
}

func binary(f func(a, b float64) (float64, error)) spec {
	return spec{arity: 2, apply: func(x []float64) (float64, error) { return f(x[0], x[1]) }}
}

func add(a, b float64) (float64, error)      { return a + b, nil }
func subtract(a, b float64) (float64, error) { return a - b, nil }
func multiply(a, b float64) (float64, error) { return a * b, nil }

func divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return a / b, nil
}

func power(base, exponent float64) (float64, error) {
	switch {
	case base == 0 && exponent < 0:
		return 0, fmt.Errorf("%w: zero raised to a negative power", ErrDivisionByZero)
	case base < 0 && exponent != math.Trunc(exponent):
		return 0, fmt.Errorf("%w: negative base with a fractional exponent", ErrNotReal)
	}
	return math.Pow(base, exponent), nil
}

func sqrt(x float64) (float64, error) {
	if x < 0 {
		return 0, fmt.Errorf("%w: square root of a negative number", ErrNotReal)
	}
	return math.Sqrt(x), nil
}

// percentage returns p percent of base. Multiplying first is exact whenever
// the product is (7% of 1e17 is 7e15, where 0.07 × 1e17 is 7000000000000001);
// dividing first is the fallback for products that would overflow.
func percentage(p, base float64) (float64, error) {
	if product := p * base; !math.IsInf(product, 0) {
		return product / 100, nil
	}
	return p / 100 * base, nil
}

// normalize turns a raw result into the value the API returns.
func normalize(x float64) (float64, error) {
	switch {
	case math.IsNaN(x):
		return 0, ErrNotReal
	case math.IsInf(x, 0):
		return 0, fmt.Errorf("%w: magnitude exceeds %g", ErrOverflow, math.MaxFloat64)
	case x == 0:
		return 0, nil // also turns -0 into 0
	case x == math.Trunc(x), math.Abs(x) >= exactMagnitude:
		return x, nil // rounding could only drop digits that are real
	}
	// Cannot fail: x is a fraction smaller than 1e15 in magnitude.
	rounded, _ := strconv.ParseFloat(strconv.FormatFloat(x, 'g', significantDigits, 64), 64)
	return rounded, nil
}
