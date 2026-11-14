package com.tungph7.learnpostgres.common.domain;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Objects;

import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.usertype.UserType;

/**
 * Hibernate {@link UserType} for the Postgres {@code citext} column type.
 *
 * <p>Why this is needed:
 *
 * <ul>
 *   <li>{@code @JdbcTypeCode(SqlTypes.OTHER)} routes through {@code ObjectJdbcType} by default,
 *       which binds via {@code setObject(idx, value)} with no JDBC type. In the Hibernate 6 +
 *       pgjdbc combination, that path dispatches strings as binary (bytea), causing the database to
 *       store a hex string instead of plain text.
 *   <li>This {@code UserType} fixes that:
 *       <ol>
 *         <li>{@code getSqlType() = Types.OTHER} so Hibernate's {@code ddl-auto: validate} matches
 *             the {@code citext} metadata (also {@code OTHER}) and the app starts.
 *         <li>{@code nullSafeSet} uses {@code setString(...)} explicitly so pgjdbc sends text.
 *             Combined with {@code stringtype=unspecified} in the JDBC URL, pgjdbc sends with
 *             {@code Oid.UNSPECIFIED} and the server casts to {@code citext}, preserving the text.
 *         <li>{@code nullSafeGet} uses {@code getString(...)} to read {@code citext} back as a
 *             plain {@code String}.
 *       </ol>
 * </ul>
 */
public class CitextType implements UserType<String> {

  @Override
  public int getSqlType() {
    return Types.OTHER;
  }

  @Override
  public Class<String> returnedClass() {
    return String.class;
  }

  @Override
  public boolean equals(String x, String y) {
    return Objects.equals(x, y);
  }

  @Override
  public int hashCode(String x) {
    return Objects.hashCode(x);
  }

  @Override
  public String nullSafeGet(
      ResultSet rs, int position, SharedSessionContractImplementor session, Object owner)
      throws SQLException {
    return rs.getString(position);
  }

  @Override
  public void nullSafeSet(
      PreparedStatement st, String value, int index, SharedSessionContractImplementor session)
      throws SQLException {
    if (value == null) {
      st.setNull(index, Types.OTHER);
    } else {
      st.setString(index, value);
    }
  }

  @Override
  public String deepCopy(String value) {
    return value;
  }

  @Override
  public boolean isMutable() {
    return false;
  }

  @Override
  public java.io.Serializable disassemble(String value) {
    return value;
  }

  @Override
  public String assemble(java.io.Serializable cached, Object owner) {
    return (String) cached;
  }
}
