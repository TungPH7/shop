package com.tungph7.learnpostgres.feature.product.dto;

import java.util.regex.Pattern;

import com.fasterxml.jackson.annotation.JsonValue;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

/**
 * The field {@code categoryId} of the edit of a product, which tells "absent" from {@code null}
 * (plan of SHOP-81, Architecture Decisions 7, NFR19):
 *
 * <ul>
 *   <li>absent ({@link #ABSENT}): keep the category the product has, so the edit form of {@code
 *       v0.3.0}, which knows no category, does not drop it;
 *   <li>{@code null} ({@link #NULL}): no category;
 *   <li>a string: the id of a category, checked as a UUID by {@link
 *       com.tungph7.learnpostgres.feature.product.validation.ValidCategoryId}, then as an existing
 *       category by the service.
 * </ul>
 *
 * <p>Any other JSON value, such as a number or an object, is kept as its JSON text, so it is a
 * field error on {@code categoryId} next to the others, not a body that cannot be read. As a JSON
 * value, such as the {@code rejectedValue} of a field error, the field is its text.
 *
 * @param present whether the request has the field
 * @param value the id sent, or {@code null}
 */
@JsonDeserialize(using = CategoryIdField.Deserializer.class)
public record CategoryIdField(boolean present, @JsonValue String value) {

  /** The request has no field {@code categoryId}: the category is kept. */
  public static final CategoryIdField ABSENT = new CategoryIdField(false, null);

  /** {@code "categoryId": null}: the product has no category. */
  public static final CategoryIdField NULL = new CategoryIdField(true, null);

  /** The length of the canonical text of a UUID. */
  public static final int UUID_LENGTH = 36;

  /** The canonical text of a UUID, 8-4-4-4-12 hexadecimal digits. */
  public static final Pattern UUID_FORMAT =
      Pattern.compile(
          "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

  /**
   * Whether a text is {@code null} or the canonical text of a UUID. The length is checked first, so
   * a long text never reaches the pattern.
   */
  public static boolean isUuidOrNull(String text) {
    return text == null || (text.length() == UUID_LENGTH && UUID_FORMAT.matcher(text).matches());
  }

  /** {@code "categoryId": "<value>"}. */
  public static CategoryIdField of(String value) {
    return new CategoryIdField(true, value);
  }

  /** Reads the field: absent, {@code null}, or the text of any other value. */
  static final class Deserializer extends ValueDeserializer<CategoryIdField> {

    @Override
    public CategoryIdField deserialize(JsonParser parser, DeserializationContext context) {
      if (parser.currentToken() == JsonToken.VALUE_STRING) {
        return of(parser.getString());
      }
      return of(context.readTree(parser).toString());
    }

    @Override
    public Object getNullValue(DeserializationContext context) {
      return NULL;
    }

    @Override
    public Object getAbsentValue(DeserializationContext context) {
      return ABSENT;
    }
  }
}
