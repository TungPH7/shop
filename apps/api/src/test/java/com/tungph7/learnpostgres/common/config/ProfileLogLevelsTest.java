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
 */
class ProfileLogLevelsTest {

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
    YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
    yaml.setResources(new ClassPathResource(file));
    Properties properties = yaml.getObject();

    assertThat(levelsOfTheBindLoggerChain(properties))
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
}
