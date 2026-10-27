package calculator

import (
	"errors"
	"math"
	"testing"
)

// normalize is tested directly because some of its guards (NaN, for one) are
// unreachable through Calculate today; they protect future operations.
func TestNormalize(t *testing.T) {
	tests := []struct {
		name    string
		in      float64
		want    float64
		wantErr error
	}{
		{"binary rounding noise is removed", 0.1 + 0.2, 0.3, nil},
		{"fractions keep 15 significant digits", 1.0 / 7, 0.142857142857143, nil},
		{"negative fractions are rounded too", -2.0 / 3, -0.666666666666667, nil},
		{"integers stay exact", 1 << 53, 1 << 53, nil},
		{"fractions from 1e15 up keep every digit", 1e15 + 0.5, 1e15 + 0.5, nil},
		{"fractions just below 1e15 are still rounded", 999_999_999_999_999.4, 999_999_999_999_999, nil},
		{"the largest float64 stays put", math.MaxFloat64, math.MaxFloat64, nil},
		{"negative zero becomes zero", math.Copysign(0, -1), 0, nil},
		{"NaN is not a real number", math.NaN(), 0, ErrNotReal},
		{"+Inf overflows", math.Inf(1), 0, ErrOverflow},
		{"-Inf overflows", math.Inf(-1), 0, ErrOverflow},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalize(tt.in)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("normalize(%v) error = %v, want %v", tt.in, err, tt.wantErr)
			}
			if got != tt.want || math.Signbit(got) != math.Signbit(tt.want) {
				t.Errorf("normalize(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

// FuzzNormalize checks that normalize never reorders values: x <= y implies
// normalize(x) <= normalize(y). Rounding away real digits breaks this; it is
// how 2^50 + 0.5 once came out smaller than 2^50.
func FuzzNormalize(f *testing.F) {
	f.Add(float64(1<<50), float64(1<<50)+0.5)
	f.Add(0.1+0.2, 0.3)
	f.Add(999_999_999_999_999.9, 1e15)
	f.Add(-1e15-0.5, -999_999_999_999_999.9)
	f.Add(2.9999999999999996, 3.0)

	f.Fuzz(func(t *testing.T, x, y float64) {
		if x > y {
			x, y = y, x
		}
		nx, errX := normalize(x)
		ny, errY := normalize(y)
		if errX != nil || errY != nil {
			return // NaN and ±Inf are rejected, so there is no order to keep
		}
		if nx > ny {
			t.Fatalf("normalize(%v) = %v is above normalize(%v) = %v", x, nx, y, ny)
		}
	})
}
