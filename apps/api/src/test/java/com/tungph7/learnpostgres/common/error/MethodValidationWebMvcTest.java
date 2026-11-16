package com.tungph7.learnpostgres.common.error;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tungph7.learnpostgres.common.logging.LoggingProperties;
import com.tungph7.learnpostgres.common.security.TestSecurityConfig;

/**
 * The method validation of Spring MVC on a handler with both a {@code @Valid @RequestBody} and a
 * constrained parameter (SHOP-46): Spring then validates the body as one of the arguments and
 * throws {@code HandlerMethodValidationException} with its {@code ParameterErrors}, not {@code
 * MethodArgumentNotValidException}. The body must still be a 400 {@code VALIDATION_FAILED} listing
 * its fields, and never be echoed whole into the response.
 */
@WebMvcTest(MethodValidationWebMvcTest.NotesController.class)
@Import({
  TestSecurityConfig.class,
  GlobalExceptionHandler.class,
  ProblemDetailFactory.class,
  MethodValidationWebMvcTest.NotesController.class
})
@EnableConfigurationProperties(LoggingProperties.class)
class MethodValidationWebMvcTest {

  private static final String URL = "/test/notes";

  record Note(@NotBlank(message = "must not be blank") String title, String text) {}

  @RestController
  static class NotesController {

    @PostMapping(URL)
    String create(
        @Valid @RequestBody Note note,
        @RequestParam(name = "copies", defaultValue = "1") @Min(1) int copies) {
      return "ok";
    }
  }

  @Autowired MockMvc mockMvc;

  @Test
  void anInvalidBodyNextToAConstrainedParameter_isA400ListingTheFieldsOfTheBody() throws Exception {
    mockMvc
        .perform(
            post(URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\" \",\"text\":\"private text of the note\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.detail").value("Validation failed for 1 field(s)."))
        .andExpect(jsonPath("$.errors", hasSize(1)))
        .andExpect(jsonPath("$.errors[0].field").value("title"))
        .andExpect(jsonPath("$.errors[0].message").value("must not be blank"))
        .andExpect(jsonPath("$.parameter").doesNotExist())
        .andExpect(content().string(not(containsString("private text of the note"))));
  }

  @Test
  void anInvalidParameterNextToAValidBody_isA400NamingTheParameter() throws Exception {
    mockMvc
        .perform(
            post(URL + "?copies=0")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Hello\",\"text\":\"private text of the note\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.parameter").value("copies"))
        .andExpect(jsonPath("$.rejectedValue").doesNotExist())
        .andExpect(content().string(not(containsString("private text of the note"))));
  }
}
