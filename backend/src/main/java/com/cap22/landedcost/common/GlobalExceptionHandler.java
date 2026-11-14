package com.cap22.landedcost.common;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException ex) {

        return ResponseEntity.status(ex.getStatus()).body(Map.of(
                "timestamp", Instant.now().toString(),
                "status", ex.getStatus().value(),
                "error", ex.getStatus().getReasonPhrase(),
                "code", ex.getCode(),
                "message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {

        String msg = ex.getBindingResult().getFieldErrors().stream()
                .findFirst().map(e -> e.getField() + " " + e.getDefaultMessage())
                .orElse("Validation failed");

        return ResponseEntity.badRequest().body(Map.of(
                "timestamp", Instant.now().toString(),
                "status", 400,
                "error", "Bad Request",
                "code", "VALIDATION_ERROR",
                "message", msg));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleOther(Exception ex) {

        return ResponseEntity.status(500).body(Map.of(
                "timestamp", Instant.now().toString(),
                "status", 500,
                "error", "Internal Server Error",
                "message", ex.getMessage() == null ? "Unexpected error" : ex.getMessage()));
    }
}
