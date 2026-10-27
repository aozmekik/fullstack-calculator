package calculator_test

import (
	"errors"
	"math"
	"slices"
	"testing"

	"github.com/aozmekik/fullstack-calculator/backend/internal/calculator"
)

var negativeZero = math.Copysign(0, -1)

func TestCalculate(t *testing.T) {
	tests := []struct {
		name     string
		op       calculator.Operation
		operands []float64
		want     float64
	}{
		{"add", calculator.Add, []float64{2, 3}, 5},
		{"add negatives", calculator.Add, []float64{-2.5, -0.5}, -3},
		{"add hides binary rounding noise", calculator.Add, []float64{0.1, 0.2}, 0.3},
		{"add keeps integers exact", calculator.Add, []float64{999_999_999_999_999, 2}, 1_000_000_000_000_001},
		{"add keeps every digit of a large fraction", calculator.Add, []float64{1 << 50, 0.5}, 1_125_899_906_842_624.5},
		{"add at the float64 limit", calculator.Add, []float64{math.MaxFloat64, 0}, math.MaxFloat64},
		{"subtract", calculator.Subtract, []float64{10, 4}, 6},
		{"subtract to zero", calculator.Subtract, []float64{0.3, 0.3}, 0},
		{"multiply", calculator.Multiply, []float64{6, 7}, 42},
		{"multiply fractions", calculator.Multiply, []float64{1.1, 1.1}, 1.21},
		{"multiply negative by zero gives zero, not -0", calculator.Multiply, []float64{-1, 0}, 0},
		{"divide", calculator.Divide, []float64{10, 4}, 2.5},
		{"divide repeating decimal", calculator.Divide, []float64{1, 3}, 0.333333333333333},
		{"divide rounds the last digit", calculator.Divide, []float64{2, 3}, 0.666666666666667},
		{"divide zero by a negative gives zero, not -0", calculator.Divide, []float64{0, -5}, 0},
		{"power", calculator.Power, []float64{2, 10}, 1024},
		{"power keeps integers exact", calculator.Power, []float64{2, 50}, 1_125_899_906_842_624},
		{"power with fractional exponent", calculator.Power, []float64{9, 0.5}, 3},
		{"power with negative exponent", calculator.Power, []float64{2, -2}, 0.25},
		{"power of negative base with integer exponent", calculator.Power, []float64{-2, 3}, -8},
		{"power zero to the zero", calculator.Power, []float64{0, 0}, 1},
		{"power underflows to zero", calculator.Power, []float64{10, -400}, 0},
		{"sqrt", calculator.Sqrt, []float64{16}, 4},
		{"sqrt irrational", calculator.Sqrt, []float64{2}, 1.4142135623731},
		{"sqrt of negative zero", calculator.Sqrt, []float64{negativeZero}, 0},
		{"percentage", calculator.Percentage, []float64{15, 200}, 30},
		{"percentage with fractional result", calculator.Percentage, []float64{7, 3}, 0.21},
		{"percentage of a large base is exact", calculator.Percentage, []float64{7, 1e17}, 7e15},
		{"percentage of a huge base does not overflow", calculator.Percentage, []float64{50, math.MaxFloat64}, math.MaxFloat64 / 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := calculator.Calculate(tt.op, tt.operands...)
			if err != nil {
				t.Fatalf("Calculate(%s, %v) returned error: %v", tt.op, tt.operands, err)
			}
			if got != tt.want || math.Signbit(got) != math.Signbit(tt.want) {
				t.Errorf("Calculate(%s, %v) = %v, want %v", tt.op, tt.operands, got, tt.want)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name     string
		op       calculator.Operation
		operands []float64
		want     error
	}{
		{"unknown operation", "modulo", []float64{1, 2}, calculator.ErrUnknownOperation},
		{"no operands", calculator.Add, nil, calculator.ErrOperandCount},
		{"too few operands", calculator.Divide, []float64{1}, calculator.ErrOperandCount},
		{"too many operands", calculator.Add, []float64{1, 2, 3}, calculator.ErrOperandCount},
		{"too many operands for sqrt", calculator.Sqrt, []float64{4, 2}, calculator.ErrOperandCount},
		{"NaN operand", calculator.Add, []float64{math.NaN(), 1}, calculator.ErrInvalidOperand},
		{"infinite operand", calculator.Multiply, []float64{math.Inf(1), 0}, calculator.ErrInvalidOperand},
		{"divide by zero", calculator.Divide, []float64{1, 0}, calculator.ErrDivisionByZero},
		{"divide by negative zero", calculator.Divide, []float64{1, negativeZero}, calculator.ErrDivisionByZero},
		{"zero divided by zero", calculator.Divide, []float64{0, 0}, calculator.ErrDivisionByZero},
		{"zero to a negative power", calculator.Power, []float64{0, -1}, calculator.ErrDivisionByZero},
		{"negative zero to a negative power", calculator.Power, []float64{negativeZero, -1}, calculator.ErrDivisionByZero},
		{"negative base with fractional exponent", calculator.Power, []float64{-8, 1.0 / 3}, calculator.ErrNotReal},
		{"square root of a negative", calculator.Sqrt, []float64{-1}, calculator.ErrNotReal},
		{"multiply overflows", calculator.Multiply, []float64{1e308, 10}, calculator.ErrOverflow},
		{"subtract overflows", calculator.Subtract, []float64{-math.MaxFloat64, math.MaxFloat64}, calculator.ErrOverflow},
		{"power overflows", calculator.Power, []float64{10, 400}, calculator.ErrOverflow},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := calculator.Calculate(tt.op, tt.operands...)
			if !errors.Is(err, tt.want) {
				t.Fatalf("Calculate(%s, %v) = %v, %v; want error %v", tt.op, tt.operands, got, err, tt.want)
			}
		})
	}
}

// The API returns these messages to clients, so they must name the problem.
func TestCalculateErrorMessages(t *testing.T) {
	tests := []struct {
		op       calculator.Operation
		operands []float64
		want     string
	}{
		{calculator.Add, []float64{1, 2, 3}, "wrong number of operands: add takes 2, got 3"},
		{calculator.Sqrt, []float64{-4}, "result is not a real number: square root of a negative number"},
		{calculator.Power, []float64{0, -2}, "division by zero: zero raised to a negative power"},
		{calculator.Power, []float64{10, 400}, "result is out of range: magnitude exceeds 1.7976931348623157e+308"},
	}
	for _, tt := range tests {
		_, err := calculator.Calculate(tt.op, tt.operands...)
		if err == nil || err.Error() != tt.want {
			t.Errorf("Calculate(%s, %v) error = %v, want %q", tt.op, tt.operands, err, tt.want)
		}
	}
}

func TestOperations(t *testing.T) {
	want := []calculator.Operation{
		calculator.Add, calculator.Divide, calculator.Multiply, calculator.Percentage,
		calculator.Power, calculator.Sqrt, calculator.Subtract,
	}
	if got := calculator.Operations(); !slices.Equal(got, want) {
		t.Errorf("Operations() = %v, want %v", got, want)
	}
}
