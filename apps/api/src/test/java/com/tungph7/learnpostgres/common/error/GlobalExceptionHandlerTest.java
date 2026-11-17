package com.tungph7.learnpostgres.common.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.assertj.core.api.InstanceOfAssertFactories;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.support.DefaultMessageSourceResolvable;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.MethodValidationResult;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.tungph7.learnpostgres.common.logging.LoggingProperties;

class GlobalExceptionHandlerTest {

  private final ProblemDetailFactory factory =
      new ProblemDetailFactory("about:blank", new LoggingProperties(null, null, 0));
  private final GlobalExceptionHandler handler = new GlobalExceptionHandler(factory);

  private HttpServletRequest request() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    when(req.getRequestURI()).thenReturn("/api/test");
    return req;
  }

  static class FakeBusinessException extends BusinessException {
    FakeBusinessException(ErrorCode code, HttpStatus status, String detail) {
      super(code, status, detail, null);
    }
  }

  @Test
  void handleBusiness_5xx_returns_status_from_exception() {
    BusinessException ex =
        new FakeBusinessException(
            ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR, "boom");

    ResponseEntity<ProblemDetail> resp = handler.handleBusiness(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    assertThat(resp.getBody().getProperties()).containsEntry("code", "INTERNAL_ERROR");
  }

  @Test
  void handleBusiness_4xx_returns_status_from_exception() {
    BusinessException ex = new NotFoundException(ErrorCode.PRODUCT_NOT_FOUND, "missing");

    ResponseEntity<ProblemDetail> resp = handler.handleBusiness(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(resp.getBody().getProperties()).containsEntry("code", "PRODUCT_NOT_FOUND");
  }

  @Test
  void handleNotReadable_returns_400_malformed() {
    HttpInputMessage msg = mock(HttpInputMessage.class);
    HttpMessageNotReadableException ex =
        new HttpMessageNotReadableException(
            "bad json", new RuntimeException("root cause msg"), msg);

    ResponseEntity<ProblemDetail> resp = handler.handleNotReadable(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getProperties()).containsEntry("code", "MALFORMED_REQUEST");
  }

  @Test
  void handleNotReadable_with_null_cause() {
    HttpInputMessage msg = mock(HttpInputMessage.class);
    HttpMessageNotReadableException ex = new HttpMessageNotReadableException("bad json", msg);

    ResponseEntity<ProblemDetail> resp = handler.handleNotReadable(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void handleTypeMismatch_returns_400_with_parameter_info() {
    MethodArgumentTypeMismatchException ex =
        new MethodArgumentTypeMismatchException(
            "abc", UUID.class, "id", null, new IllegalArgumentException());

    ResponseEntity<ProblemDetail> resp = handler.handleTypeMismatch(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getProperties()).containsEntry("code", "INVALID_PARAMETER");
    assertThat(resp.getBody().getProperties()).containsEntry("parameter", "id");
  }

  @Test
  void handleTypeMismatch_addsOnlyTheParameterOfTheApiContract() {
    MethodArgumentTypeMismatchException ex =
        new MethodArgumentTypeMismatchException(
            "abc", UUID.class, "id", null, new IllegalArgumentException());

    ResponseEntity<ProblemDetail> resp = handler.handleTypeMismatch(ex, request());

    assertThat(resp.getBody().getProperties())
        .doesNotContainKeys("rejectedValue", "expectedType", "errors");
    assertThat(resp.getBody().getDetail())
        .isEqualTo("Parameter 'id' has invalid value 'abc' (expected: UUID).");
  }

  @Test
  void handleTypeMismatch_returns_400_when_requiredType_null() {
    MethodArgumentTypeMismatchException ex =
        new MethodArgumentTypeMismatchException("abc", null, "id", null, new RuntimeException());

    ResponseEntity<ProblemDetail> resp = handler.handleTypeMismatch(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getDetail()).contains("expected: unknown");
  }

  @Test
  void handleMethodNotSupported_returns_405_with_Allow_header() {
    HttpRequestMethodNotSupportedException ex =
        new HttpRequestMethodNotSupportedException(
            "PATCH", Set.of("POST", "GET").stream().toList());

    ResponseEntity<ProblemDetail> resp = handler.handleMethodNotSupported(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
    assertThat(resp.getHeaders().get("Allow")).isNotEmpty();
    assertThat(resp.getBody().getProperties()).containsEntry("code", "METHOD_NOT_SUPPORTED");
  }

  @Test
  void handleMethodNotSupported_returns_405_when_supported_null() {
    HttpRequestMethodNotSupportedException ex =
        new HttpRequestMethodNotSupportedException("PATCH") {
          @Override
          public Set<HttpMethod> getSupportedHttpMethods() {
            return null;
          }
        };

    ResponseEntity<ProblemDetail> resp = handler.handleMethodNotSupported(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
  }

  @Test
  void handleNoResource_returns_404() throws Exception {
    NoResourceFoundException ex =
        new NoResourceFoundException(HttpMethod.GET, "/api/typo", "/api/typo");

    ResponseEntity<ProblemDetail> resp = handler.handleNoResource(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(resp.getBody().getProperties()).containsEntry("code", "RESOURCE_NOT_FOUND");
  }

  @Test
  void handleOptimisticLock_returns_409() {
    ObjectOptimisticLockingFailureException ex =
        new ObjectOptimisticLockingFailureException("Product", "abc");

    ResponseEntity<ProblemDetail> resp = handler.handleOptimisticLock(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(resp.getBody().getProperties()).containsEntry("code", "OPTIMISTIC_LOCK_CONFLICT");
  }

  @Test
  void handleDataIntegrity_returns_409_with_slug_code_when_unique_slug() {
    DataIntegrityViolationException ex =
        new DataIntegrityViolationException(
            "wrapper",
            new RuntimeException(
                "duplicate key value violates unique constraint products_slug_unique"));

    ResponseEntity<ProblemDetail> resp = handler.handleDataIntegrity(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(resp.getBody().getProperties()).containsEntry("code", "PRODUCT_SLUG_DUPLICATED");
  }

  @Test
  void handleDataIntegrity_returns_409_with_generic_code_when_other_constraint() {
    DataIntegrityViolationException ex =
        new DataIntegrityViolationException(
            "wrapper", new RuntimeException("null value in column violates not-null constraint"));

    ResponseEntity<ProblemDetail> resp = handler.handleDataIntegrity(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(resp.getBody().getProperties()).containsEntry("code", "DATA_INTEGRITY_VIOLATION");
  }

  /**
   * SHOP-53, NFR12: a NOT NULL or CHECK violation comes with {@code Failing row contains (…)}, the
   * values of the row, such as the name and the description. The log line names the constraint
   * only.
   */
  @Test
  @ExtendWith(OutputCaptureExtension.class)
  void handleDataIntegrity_logsTheConstraintNameOfHibernate_andNoValueOfTheRow(
      CapturedOutput output) {
    DataIntegrityViolationException ex =
        new DataIntegrityViolationException(
            "could not execute statement",
            new ConstraintViolationException(
                "could not execute statement",
                new SQLException(
                    "ERROR: new row for relation \"products\" violates check constraint"
                        + " \"products_price_vnd_valid\"\n  Detail: Failing row contains"
                        + " (Ao thun SHOP53, mo-ta-shop53)."),
                "products_price_vnd_valid"));

    handler.handleDataIntegrity(ex, request());

    assertThat(output.getOut())
        .contains("constraint=products_price_vnd_valid")
        .doesNotContain("Ao thun SHOP53")
        .doesNotContain("mo-ta-shop53");
  }

  @Test
  @ExtendWith(OutputCaptureExtension.class)
  void handleDataIntegrity_ofAnUnnamedConstraint_logsNoMessageOfTheDriver(CapturedOutput output) {
    DataIntegrityViolationException ex =
        new DataIntegrityViolationException(
            "wrapper", new RuntimeException("Failing row contains (Ao thun SHOP53)."));

    handler.handleDataIntegrity(ex, request());

    assertThat(output.getOut())
        .contains("code=DATA_INTEGRITY_VIOLATION constraint=unknown")
        .doesNotContain("Ao thun SHOP53");
  }

  @Test
  void handleAny_returns_500_generic() {
    Exception ex = new RuntimeException("unexpected");

    ResponseEntity<ProblemDetail> resp = handler.handleAny(ex, request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    assertThat(resp.getBody().getProperties()).containsEntry("code", "INTERNAL_ERROR");
  }

  // ---- HandlerMethodValidationException (SHOP-16, NFR3) ----

  /** Handler methods whose parameters the tests below break. */
  static class Handlers {
    int pathVariable(@PathVariable(name = "id") int id) {
      return id;
    }

    int plain(int count) {
      return count;
    }

    int bodyAndParameter(Body body, int count) {
      return count;
    }
  }

  /** A request body, as a {@code @Valid @RequestBody} of a handler method. */
  record Body(String name, String note) {}

  @Test
  void handleMethodValidation_namesAPathVariableByItsAnnotation() throws Exception {
    MethodParameter parameter = parameterOf("pathVariable");

    ResponseEntity<ProblemDetail> resp =
        handler.handleMethodValidation(invalid(parameter, -1, "must be positive"), request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getProperties())
        .containsEntry("code", "INVALID_PARAMETER")
        .containsEntry("parameter", "id")
        .doesNotContainKey("rejectedValue");
    assertThat(resp.getBody().getDetail()).contains("must be positive");
  }

  @Test
  void handleMethodValidation_ofARequestBody_listsItsFieldsLikeABodyError() throws Exception {
    Body body = new Body("", "secret note");
    ParameterErrors bodyErrors = bodyErrors(body, "name", "", "must not be blank");

    ResponseEntity<ProblemDetail> resp =
        handler.handleMethodValidation(
            invalid(bodyErrors.getMethodParameter().getMethod(), bodyErrors), request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getProperties())
        .containsEntry("code", "VALIDATION_FAILED")
        .doesNotContainKeys("parameter", "rejectedValue");
    assertThat(resp.getBody().getDetail()).isEqualTo("Validation failed for 1 field(s).");
    assertThat(resp.getBody().getProperties().get("errors"))
        .asInstanceOf(InstanceOfAssertFactories.LIST)
        .singleElement()
        .isEqualTo(Map.of("field", "name", "rejectedValue", "", "message", "must not be blank"));
    assertThat(resp.getBody().toString()).doesNotContain("secret note");
  }

  @Test
  void handleMethodValidation_ofABodyAndAParameter_namesTheParameterWithoutTheBody()
      throws Exception {
    Body body = new Body("", "secret note");
    ParameterErrors bodyErrors = bodyErrors(body, "name", "", "must not be blank");
    MethodParameter count =
        new MethodParameter(
            Handlers.class.getDeclaredMethod("bodyAndParameter", Body.class, int.class), 1);

    ResponseEntity<ProblemDetail> resp =
        handler.handleMethodValidation(
            invalid(count.getMethod(), bodyErrors, result(count, -1, "must be positive")),
            request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getProperties())
        .containsEntry("code", "INVALID_PARAMETER")
        .containsEntry("parameter", "count")
        .doesNotContainKey("rejectedValue");
    assertThat(resp.getBody().getDetail()).doesNotContain("secret note");
  }

  @Test
  void handleMethodValidation_ofABodyWithOnlyAnObjectError_isABodyErrorWithoutTheBody()
      throws Exception {
    MethodParameter parameter =
        new MethodParameter(
            Handlers.class.getDeclaredMethod("bodyAndParameter", Body.class, int.class), 0);
    Body body = new Body("a", "secret note");
    BeanPropertyBindingResult errors = new BeanPropertyBindingResult(body, "body");
    errors.reject("Invalid", "is invalid");
    ParameterErrors objectError = new ParameterErrors(parameter, body, errors, null, null, null);

    ResponseEntity<ProblemDetail> resp =
        handler.handleMethodValidation(invalid(parameter.getMethod(), objectError), request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getProperties())
        .containsEntry("code", "VALIDATION_FAILED")
        .doesNotContainKey("parameter");
    assertThat(resp.getBody().toString()).doesNotContain("secret note");
  }

  @Test
  void handleMethodValidation_namesAParameterWithNoAnnotationByItsJavaName() throws Exception {
    MethodParameter parameter = parameterOf("plain");

    ResponseEntity<ProblemDetail> resp =
        handler.handleMethodValidation(invalid(parameter, 0, "too small"), request());

    assertThat(resp.getBody().getProperties()).containsEntry("parameter", "count");
  }

  @Test
  void handleMethodValidation_withNoMessage_saysTheValueIsInvalid() throws Exception {
    MethodParameter parameter = parameterOf("pathVariable");

    ResponseEntity<ProblemDetail> resp =
        handler.handleMethodValidation(invalid(parameter, 7, " "), request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getDetail()).contains("is invalid");
  }

  @Test
  void handleMethodValidation_ofAReturnValue_isAServerError() throws Exception {
    MethodParameter returnValue =
        new MethodParameter(Handlers.class.getDeclaredMethod("plain", int.class), -1);

    ResponseEntity<ProblemDetail> resp =
        handler.handleMethodValidation(invalid(returnValue, 5, "too big"), request());

    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    assertThat(resp.getBody().getProperties())
        .containsEntry("code", "INTERNAL_ERROR")
        .doesNotContainKey("parameter");
  }

  private static MethodParameter parameterOf(String methodName) throws NoSuchMethodException {
    return new MethodParameter(Handlers.class.getDeclaredMethod(methodName, int.class), 0);
  }

  private static HandlerMethodValidationException invalid(
      MethodParameter parameter, Object value, String message) {
    return invalid(parameter.getMethod(), result(parameter, value, message));
  }

  private static HandlerMethodValidationException invalid(
      Method method, ParameterValidationResult... results) {
    return new HandlerMethodValidationException(
        MethodValidationResult.create(new Handlers(), method, List.of(results)));
  }

  private static ParameterValidationResult result(
      MethodParameter parameter, Object value, String message) {
    return new ParameterValidationResult(
        parameter,
        value,
        List.of(new DefaultMessageSourceResolvable(new String[] {"Min"}, message)),
        null,
        null,
        null,
        (error, type) -> null);
  }

  /** The errors of the body, parameter 0 of {@code bodyAndParameter}, with one field error. */
  private static ParameterErrors bodyErrors(
      Body body, String field, Object rejectedValue, String message) throws NoSuchMethodException {
    MethodParameter parameter =
        new MethodParameter(
            Handlers.class.getDeclaredMethod("bodyAndParameter", Body.class, int.class), 0);
    BeanPropertyBindingResult errors = new BeanPropertyBindingResult(body, "body");
    errors.addError(
        new FieldError(
            "body", field, rejectedValue, false, new String[] {"NotBlank"}, null, message));
    return new ParameterErrors(parameter, body, errors, null, null, null);
  }
}
