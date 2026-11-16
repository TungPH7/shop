package com.tungph7.learnpostgres.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Properties;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

/**
 * No profile logs the values bound to SQL statements (NFR12, SHOP-46): at {@code TRACE}, {@code
 * org.hibernate.orm.jdbc.bind} writes each parameter of an INSERT, such as the name and the
 * description of a product. The {@code dev} profile matters most, since {@code api} uses it when
 * {@code SPRING_PROFILES_ACTIVE} is unset.
 */
class ProfileLogLevelsTest {

  private static final String BIND_LOGGER = "logging.level.org.hibernate.orm.jdbc.bind";

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

    assertThat(properties.getProperty(BIND_LOGGER, "INFO")).isIn("INFO", "WARN", "ERROR", "OFF");
  }
}
