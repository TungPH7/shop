package com.tungph7.learnpostgres.common.logging;

import java.util.Optional;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;

@Component
public class CorrelationContext {

  private final LoggingProperties props;

  public CorrelationContext(LoggingProperties props) {
    this.props = props;
  }

  /** Empty when MDC is not populated (e.g. called outside a request thread). */
  public Optional<String> currentId() {
    return Optional.ofNullable(MDC.get(props.correlationIdMdcKey()));
  }

  public String headerName() {
    return props.correlationIdHeader();
  }
}
