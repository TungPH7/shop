package com.tungph7.learnpostgres;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan(basePackages = "com.tungph7.learnpostgres")
public class LearnPostgresqlApiApplication {

  public static void main(String[] args) {

    SpringApplication.run(LearnPostgresqlApiApplication.class, args);
  }
}
