package com.tungph7.learnpostgres.common.text;

/**
 * The white space of a form field, as the forms of {@code admin} and {@code user} see it: {@code
 * String.prototype.trim()} of JavaScript, so a value the form takes as blank is blank for {@code
 * api} too.
 *
 * <p>{@link String#strip()} and {@link String#isBlank()} of Java miss some of it: U+00A0, U+2007,
 * U+202F (no-break spaces) and U+FEFF (byte order mark) are not white space for {@link
 * Character#isWhitespace(int)}. The white space here is that of ECMAScript: TAB, VT, FF, SP,
 * U+00A0, U+FEFF, every other space separator (Unicode {@code Zs}), and the line terminators LF,
 * CR, U+2028 and U+2029.
 */
public final class FormText {

  private FormText() {}

  /**
   * The value without white space at either end, as {@code trim()} of JavaScript; {@code null}
   * stays {@code null}.
   */
  public static String trim(String value) {
    if (value == null) {
      return null;
    }
    int start = 0;
    int end = value.length();
    while (start < end && isWhiteSpace(value.charAt(start))) {
      start++;
    }
    while (end > start && isWhiteSpace(value.charAt(end - 1))) {
      end--;
    }
    return value.substring(start, end);
  }

  /** Whether the value is {@code null}, empty or only white space. */
  public static boolean isBlank(String value) {
    return value == null || trim(value).isEmpty();
  }

  /**
   * Whether a character is white space or a line terminator for ECMAScript: one of the control
   * characters TAB, LF, VT, FF and CR, U+FEFF, or a character of Unicode {@code Zs} (SP, U+00A0
   * and the other spaces), {@code Zl} (U+2028) or {@code Zp} (U+2029).
   */
  static boolean isWhiteSpace(char c) {
    return switch (c) {
      case '\t', '\n', '\u000B', '\f', '\r', '\uFEFF' -> true;
      default ->
          switch (Character.getType(c)) {
            case Character.SPACE_SEPARATOR,
                    Character.LINE_SEPARATOR,
                    Character.PARAGRAPH_SEPARATOR ->
                true;
            default -> false;
          };
    };
  }
}
