package server

import (
	"net/http"

	"github.com/aozmekik/fullstack-calculator/backend/internal/calculator"
)

type calculationRequest struct {
	// Operands are pointers so that a JSON null can be rejected; decoded into a
	// plain float64 it would silently become 0.
	Operands []*float64 `json:"operands"`
}

type calculationResponse struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []float64            `json:"operands"`
	Result    float64              `json:"result"`
}

func (s *server) handleCalculate(op calculator.Operation) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp, err := calculate(r, op)
		if err != nil {
			s.writeError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

func calculate(r *http.Request, op calculator.Operation) (*calculationResponse, error) {
	req, err := decodeJSON[calculationRequest](r)
	if err != nil {
		return nil, err
	}
	operands, err := req.values()
	if err != nil {
		return nil, err
	}
	result, err := calculator.Calculate(op, operands...)
	if err != nil {
		return nil, err
	}
	return &calculationResponse{Operation: op, Operands: operands, Result: result}, nil
}

// values dereferences the operands, rejecting nulls.
func (req *calculationRequest) values() ([]float64, error) {
	values := make([]float64, len(req.Operands))
	for i, operand := range req.Operands {
		if operand == nil {
			return nil, invalidRequest("operands[%d] must be a number, not null", i)
		}
		values[i] = *operand
	}
	return values, nil
}
