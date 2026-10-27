package server

import (
	"encoding/json/jsontext"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/iotest"
)

func TestFieldName(t *testing.T) {
	tests := []struct {
		pointer jsontext.Pointer
		want    string
	}{
		{"", "request body"},
		{"/operands", "operands"},
		{"/operands/1", "operands[1]"},
		{"/outer/inner", "outer.inner"},
		{"/0", "0"},
	}
	for _, tt := range tests {
		if got := fieldName(tt.pointer); got != tt.want {
			t.Errorf("fieldName(%q) = %q, want %q", tt.pointer, got, tt.want)
		}
	}
}

func TestDescribeJSONErrorFallsBackToGenericMessage(t *testing.T) {
	if got := describeJSONError(errors.New("something new")).message; got != "malformed JSON" {
		t.Errorf("message = %q, want %q", got, "malformed JSON")
	}
}

func TestDecodeJSONUnreadableBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", iotest.ErrReader(errors.New("connection reset")))
	req.Header.Set("Content-Type", "application/json")

	_, err := decodeJSON[calculationRequest](req)

	apiErr := toAPIError(err)
	if apiErr.status != http.StatusBadRequest || err.Error() != "could not read request body" {
		t.Errorf("got %d %q, want 400 %q", apiErr.status, err, "could not read request body")
	}
}
