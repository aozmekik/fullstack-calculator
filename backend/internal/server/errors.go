package server

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/aozmekik/fullstack-calculator/backend/internal/calculator"
)

// Error codes are part of the API contract: clients switch on them, so a code
// never changes meaning once published.
const (
	codeInvalidRequest       = "invalid_request"
	codeNotFound             = "not_found"
	codeMethodNotAllowed     = "method_not_allowed"
	codePayloadTooLarge      = "payload_too_large"
	codeUnsupportedMediaType = "unsupported_media_type"
	codeDivisionByZero       = "division_by_zero"
	codeNotARealNumber       = "not_a_real_number"
	codeResultOutOfRange     = "result_out_of_range"
	codeInternal             = "internal_error"
)

// apiError is an error reported to the client as is.
type apiError struct {
	status  int
	code    string
	message string
}

func (e *apiError) Error() string { return e.message }

func newAPIError(status int, code, format string, args ...any) *apiError {
	return &apiError{status: status, code: code, message: fmt.Sprintf(format, args...)}
}

func invalidRequest(format string, args ...any) *apiError {
	return newAPIError(http.StatusBadRequest, codeInvalidRequest, format, args...)
}

var errInternal = &apiError{
	status:  http.StatusInternalServerError,
	code:    codeInternal,
	message: "internal server error",
}

// domainErrors maps calculator failures to responses. A malformed calculation
// is the client's fault (400); a well-formed one that has no answer, such as
// 1 ÷ 0, is unprocessable (422). calculator.ErrUnknownOperation is absent on
// purpose: routes exist only for known operations, so hitting it is a bug.
var domainErrors = []struct {
	err    error
	status int
	code   string
}{
	{calculator.ErrOperandCount, http.StatusBadRequest, codeInvalidRequest},
	{calculator.ErrInvalidOperand, http.StatusBadRequest, codeInvalidRequest},
	{calculator.ErrDivisionByZero, http.StatusUnprocessableEntity, codeDivisionByZero},
	{calculator.ErrNotReal, http.StatusUnprocessableEntity, codeNotARealNumber},
	{calculator.ErrOverflow, http.StatusUnprocessableEntity, codeResultOutOfRange},
}

// toAPIError converts err into what the client sees. Unrecognized errors
// become a generic 500 so that internal details never leak.
func toAPIError(err error) *apiError {
	if apiErr, ok := errors.AsType[*apiError](err); ok {
		return apiErr
	}
	for _, d := range domainErrors {
		if errors.Is(err, d.err) {
			return &apiError{status: d.status, code: d.code, message: err.Error()}
		}
	}
	return errInternal
}

// writeError sends err as a JSON error response and logs server-side failures.
func (s *server) writeError(w http.ResponseWriter, r *http.Request, err error) {
	apiErr := toAPIError(err)
	if apiErr.status >= http.StatusInternalServerError {
		s.logger.ErrorContext(r.Context(), "request failed",
			"error", err, "request_id", requestIDFrom(r.Context()))
	}
	writeAPIError(w, apiErr)
}

type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeAPIError(w http.ResponseWriter, err *apiError) {
	writeJSON(w, err.status, errorResponse{Error: errorBody{Code: err.code, Message: err.message}})
}
