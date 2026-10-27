package server

import (
	"bytes"
	"encoding/json/jsontext"
	"encoding/json/v2"
	"errors"
	"io"
	"mime"
	"net/http"
	"reflect"
	"strconv"
	"strings"
)

// maxBodyBytes caps request bodies; a calculation request is a few dozen bytes.
const maxBodyBytes = 4 << 10

var (
	errUnsupportedMediaType = newAPIError(http.StatusUnsupportedMediaType, codeUnsupportedMediaType,
		"Content-Type must be application/json")
	errPayloadTooLarge = newAPIError(http.StatusRequestEntityTooLarge, codePayloadTooLarge,
		"request body must not exceed %d bytes", maxBodyBytes)
)

// decodeJSON decodes a request body holding exactly one JSON object into a T.
// The body is already capped by the limitBodies middleware.
//
// It uses encoding/json/v2, which, unlike v1, matches member names
// case-sensitively, rejects duplicate names and trailing data, and reports
// typed errors that point at the offending value.
func decodeJSON[T any](r *http.Request) (*T, error) {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return nil, errUnsupportedMediaType
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			return nil, errPayloadTooLarge
		}
		return nil, invalidRequest("could not read request body")
	}
	if len(bytes.TrimSpace(body)) == 0 {
		return nil, invalidRequest("request body is empty; expected a JSON object")
	}
	// Decoding into a pointer leaves it nil for a JSON null, which is not an object.
	var dst *T
	if err := json.Unmarshal(body, &dst, json.RejectUnknownMembers(true)); err != nil {
		return nil, describeJSONError(err)
	}
	if dst == nil {
		return nil, invalidRequest("request body must be a JSON object")
	}
	return dst, nil
}

// describeJSONError turns a decoding error into a client-facing message that
// names the offending field, such as "operands[1] must be a number".
func describeJSONError(err error) *apiError {
	if serr, ok := errors.AsType[*json.SemanticError](err); ok {
		field := fieldName(serr.JSONPointer)
		switch {
		case errors.Is(serr.Err, json.ErrUnknownName):
			return invalidRequest("unknown field %q", field)
		case errors.Is(serr.Err, strconv.ErrRange):
			return invalidRequest("%s is outside the range of a 64-bit float", field)
		case serr.GoType != nil:
			return invalidRequest("%s must be %s", field, describeType(serr.GoType))
		}
	}
	if serr, ok := errors.AsType[*jsontext.SyntacticError](err); ok {
		if errors.Is(serr.Err, jsontext.ErrDuplicateName) {
			return invalidRequest("duplicate field %q", fieldName(serr.JSONPointer))
		}
		return invalidRequest("malformed JSON at byte %d: %v", serr.ByteOffset, serr.Err)
	}
	return invalidRequest("malformed JSON")
}

// fieldName renders a JSON pointer such as /operands/1 as operands[1].
func fieldName(ptr jsontext.Pointer) string {
	var b strings.Builder
	for token := range ptr.Tokens() {
		if _, err := strconv.Atoi(token); err == nil && b.Len() > 0 {
			b.WriteString("[" + token + "]")
			continue
		}
		if b.Len() > 0 {
			b.WriteByte('.')
		}
		b.WriteString(token)
	}
	if b.Len() == 0 {
		return "request body"
	}
	return b.String()
}

// describeType names the JSON shape expected for t. Request types are built
// only from objects, arrays and numbers.
func describeType(t reflect.Type) string {
	switch t.Kind() {
	case reflect.Struct:
		return "a JSON object"
	case reflect.Slice:
		return "an array"
	default:
		return "a number"
	}
}

// writeJSON sends v with the given status. Every response type is plain data,
// so MarshalWrite can only fail if the client has gone away; the status is
// already sent by then, so the error is deliberately dropped.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.MarshalWrite(w, v)
	_, _ = io.WriteString(w, "\n")
}
