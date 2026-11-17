package com.tungph7.learnpostgres.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TreeMap;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

/**
 * No profile logs the values bound to SQL statements (NFR12, SHOP-46): at {@code TRACE}, {@code
 * org.hibernate.orm.jdbc.bind} writes each parameter of an INSERT, such as the name and the
 * description of a product. The {@code dev} profile matters most, since {@code api} uses it when
 * {@code SPRING_PROFILES_ACTIVE} is unset.
 *
 * <p>The logger inherits the level of its parents when it has none, so each logger of the chain,
 * from {@code root} to {@code org.hibernate.orm.jdbc.bind}, must stay at {@code INFO} or above
 * (SHOP-49). Spring Boot reads the names of the loggers and their levels ignoring case, and so does
 * this test.
 *
 * <p>Nor does any profile log a failed statement with its values (SHOP-51): {@code application.yml}
 * turns {@code org.hibernate.orm.jdbc.error} off, and no profile turns it back on.
 *
 * <p>Nor does PgJDBC put the values of a failed statement into its exceptions (SHOP-53, SHOP-59):
 * {@code application.yml} sets {@code logServerErrorDetail=false} on the datasource, and no profile
 * turns it back on, neither as a property of the datasource nor as a parameter of its URL. {@code
 * JdbcServerErrorDetailIntegrationTest} shows the effect, with the profile {@code test} only.
 */
class ProfileLogLevelsTest {

  /**
   * The PgJDBC property, its name lower case and without separators, as Spring Boot and PgJDBC may
   * read it written in several ways.
   */
  private static final String SERVER_ERROR_DETAIL = "logservererrordetail";

  /** The logger that writes the values bound to SQL, and each of its parents. */
  private static final List<String> BIND_LOGGER_CHAIN =
      List.of(
          "root",
          "org",
          "org.hibernate",
          "org.hibernate.orm",
          "org.hibernate.orm.jdbc",
          "org.hibernate.orm.jdbc.bind");

  private static final Set<String> QUIET_LEVELS = Set.of("INFO", "WARN", "ERROR", "OFF");

  /**
   * The logger with which Hibernate writes a failed statement with its values, such as the INSERT
   * of a product whose slug breaks {@code products_slug_unique} (SHOP-51).
   */
  private static final String JDBC_ERROR_LOGGER = "org.hibernate.orm.jdbc.error";

  @Test
  void theBaseFileTurnsOffTheLoggerOfFailedStatements() {
    assertThat(levelsOf(JDBC_ERROR_LOGGER, load("application.yml")))
        .containsExactly(Map.entry("logging.level." + JDBC_ERROR_LOGGER, "OFF"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "application-dev.yml",
        "application-test.yml",
        "application-staging.yml",
        "application-prod.yml"
      })
  void noProfileTurnsTheLoggerOfFailedStatementsBackOn(String file) {
    assertThat(levelsOf(JDBC_ERROR_LOGGER, load(file)))
        .allSatisfy(
            (logger, level) ->
                assertThat(level.toUpperCase(Locale.ROOT)).as(logger).isEqualTo("OFF"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "application.yml",
        "application-dev.yml",
        "application-test.yml",
        "application-staging.yml",
        "application-prod.yml"
      })
  void noProfileLogsTheValuesBoundToSql(String file) {
    assertThat(levelsOfTheBindLoggerChain(load(file)))
        .allSatisfy(
            (logger, level) ->
                assertThat(level.toUpperCase(Locale.ROOT)).as(logger).isIn(QUIET_LEVELS));
  }

  @Test
  void aParentOfTheBindLoggerAtTraceInLowerCase_isRead() {
    Properties properties = new Properties();
    properties.setProperty("logging.level.org.hibernate", "trace");
    properties.setProperty("logging.level.org.hibernate.SQL", "debug");

    assertThat(levelsOfTheBindLoggerChain(properties))
        .containsExactly(Map.entry("logging.level.org.hibernate", "trace"));
  }

  @Test
  void theRootLoggerWrittenInUpperCase_isRead() {
    Properties properties = new Properties();
    properties.setProperty("logging.level.ROOT", "DEBUG");

    assertThat(levelsOfTheBindLoggerChain(properties))
        .containsExactly(Map.entry("logging.level.ROOT", "DEBUG"));
  }

  @Test
  void theBaseFileKeepsTheDetailOfServerErrorsOutOfTheDriver() {
    assertThat(serverErrorDetailSettings(load("application.yml")))
        .containsExactly(
            Map.entry(
                "spring.datasource.hikari.data-source-properties.logServerErrorDetail", "false"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "application.yml",
        "application-dev.yml",
        "application-test.yml",
        "application-staging.yml",
        "application-prod.yml"
      })
  void noProfileTurnsTheDetailOfServerErrorsBackOn(String file) {
    assertThat(serverErrorDetailSettings(load(file)))
        .allSatisfy(
            (setting, value) -> assertThat(value).as(setting).isEqualToIgnoringCase("false"));
  }

  @Test
  void theDetailOfServerErrorsInKebabCase_isRead() {
    Properties properties = new Properties();
    properties.setProperty(
        "spring.datasource.hikari.data-source-properties.log-server-error-detail", "true");

    assertThat(serverErrorDetailSettings(properties))
        .containsExactly(
            Map.entry(
                "spring.datasource.hikari.data-source-properties.log-server-error-detail", "true"));
  }

  @Test
  void theDetailOfServerErrorsTurnedOnAsAYamlBoolean_isRead() {
    Properties properties = new Properties();
    properties.put("spring.datasource.hikari.data-source-properties.logServerErrorDetail", true);

    assertThat(serverErrorDetailSettings(properties))
        .containsExactly(
            Map.entry(
                "spring.datasource.hikari.data-source-properties.logServerErrorDetail", "true"));
  }

  @Test
  void theDetailOfServerErrorsAsAParameterOfTheUrl_isRead() {
    Properties properties = new Properties();
    properties.setProperty(
        "spring.datasource.url", "jdbc:postgresql://db:5432/shop?LogServerErrorDetail=True&ssl=1");

    assertThat(serverErrorDetailSettings(properties))
        .containsExactly(Map.entry("spring.datasource.url", "True"));
  }

  /**
   * The values given to {@code logServerErrorDetail}, by property name: a property of that name, in
   * any case and with any separator, or a parameter of that name in the value of a property, such
   * as a JDBC URL. Every entry is read: YAML gives an unquoted {@code true} as a {@link Boolean},
   * which {@link Properties#stringPropertyNames} skips.
   */
  private static Map<String, String> serverErrorDetailSettings(Properties properties) {
    Map<String, String> settings = new TreeMap<>();
    for (Map.Entry<Object, Object> entry : properties.entrySet()) {
      String name = String.valueOf(entry.getKey());
      String value = String.valueOf(entry.getValue());
      String bareName = name.replaceAll("[-_]", "").toLowerCase(Locale.ROOT);
      if (bareName.endsWith("." + SERVER_ERROR_DETAIL) || bareName.equals(SERVER_ERROR_DETAIL)) {
        settings.put(name, value);
      }
      int at = value.toLowerCase(Locale.ROOT).indexOf(SERVER_ERROR_DETAIL + "=");
      if (at >= 0) {
        String parameter = value.substring(at + SERVER_ERROR_DETAIL.length() + 1);
        int end = parameter.indexOf('&');
        settings.put(name, end >= 0 ? parameter.substring(0, end) : parameter);
      }
    }
    return settings;
  }

  /**
   * The levels set on a logger of the chain, by property name, the names compared ignoring case.
   */
  private static Map<String, String> levelsOfTheBindLoggerChain(Properties properties) {
    Map<String, String> levels = new TreeMap<>();
    for (String name : properties.stringPropertyNames()) {
      boolean onTheChain =
          BIND_LOGGER_CHAIN.stream()
              .anyMatch(logger -> name.equalsIgnoreCase("logging.level." + logger));
      if (onTheChain) {
        levels.put(name, properties.getProperty(name));
      }
    }
    return levels;
  }

  /** The levels set on one logger, by property name, the names compared ignoring case. */
  private static Map<String, String> levelsOf(String logger, Properties properties) {
    Map<String, String> levels = new TreeMap<>();
    for (String name : properties.stringPropertyNames()) {
      if (name.equalsIgnoreCase("logging.level." + logger)) {
        levels.put(name, properties.getProperty(name));
      }
    }
    return levels;
  }

  private static Properties load(String file) {
    YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
    yaml.setResources(new ClassPathResource(file));
    return yaml.getObject();
  }
}
