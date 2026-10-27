package calculator

import (
	"errors"
	"math"
	"slices"
	"testing"
)

// FuzzCalculate checks the invariants every caller relies on: a result is
// always finite and never -0, normalizing it again changes nothing, and every
// failure is one of the documented sentinel errors.
func FuzzCalculate(f *testing.F) {
	ops := Operations()
	seeds := []struct {
		op   Operation
		a, b float64
	}{
		{Add, 0.1, 0.2},
		{Add, math.MaxFloat64, math.MaxFloat64},
		{Subtract, 0.3, 0.3},
		{Multiply, -1, 0},
		{Divide, 1, 0},
		{Divide, 0, -5},
		{Power, -8, 1.0 / 3},
		{Power, 10, 400},
		{Power, 2, 50},
		{Sqrt, -1, 0},
		{Percentage, 15, 200},
	}
	for _, s := range seeds {
		f.Add(slices.Index(ops, s.op), s.a, s.b)
	}

	f.Fuzz(func(t *testing.T, index int, a, b float64) {
		n := len(ops)
		op := ops[(index%n+n)%n] // any int, including negatives, picks an operation
		operands := []float64{a, b}[:registry[op].arity]

		got, err := Calculate(op, operands...)
		if err != nil {
			if !isSentinel(err) {
				t.Fatalf("Calculate(%s, %v) returned undocumented error %v", op, operands, err)
			}
			return
		}
		if math.IsNaN(got) || math.IsInf(got, 0) || math.Signbit(got) && got == 0 {
			t.Fatalf("Calculate(%s, %v) = %v, want a finite number that is not -0", op, operands, got)
		}
		if again, err := normalize(got); err != nil || again != got {
			t.Fatalf("normalize(%v) = %v, %v; want it unchanged", got, again, err)
		}
	})
}

func isSentinel(err error) bool {
	sentinels := []error{
		ErrUnknownOperation, ErrOperandCount, ErrInvalidOperand,
		ErrDivisionByZero, ErrNotReal, ErrOverflow,
	}
	return slices.ContainsFunc(sentinels, func(target error) bool { return errors.Is(err, target) })
}
