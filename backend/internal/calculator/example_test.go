package calculator_test

import (
	"errors"
	"fmt"

	"github.com/aozmekik/fullstack-calculator/backend/internal/calculator"
)

func ExampleCalculate() {
	quotient, _ := calculator.Calculate(calculator.Divide, 10, 4)
	fmt.Println(quotient)

	sum, _ := calculator.Calculate(calculator.Add, 0.1, 0.2)
	fmt.Println(sum)

	_, err := calculator.Calculate(calculator.Divide, 1, 0)
	fmt.Println(err, errors.Is(err, calculator.ErrDivisionByZero))
	// Output:
	// 2.5
	// 0.3
	// division by zero true
}
