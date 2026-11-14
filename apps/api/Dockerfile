# syntax=docker/dockerfile:1.7
# =============================================================================
# Stage 1 — BUILD
# =============================================================================
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

# Copy Maven wrapper + pom đầu tiên — layer này cache miễn pom không đổi
COPY .mvn/ .mvn/
COPY mvnw mvnw.cmd pom.xml ./
RUN chmod +x mvnw

# Pre-fetch dependency — separate layer cho Docker cache
# go-offline pull dep nhưng không compile.
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -ntp dependency:go-offline

# Copy source — đổi code thì layer này invalidate (nhưng dep layer ở trên giữ cache)
COPY src ./src
COPY checkstyle.xml checkstyle-suppressions.xml ./
# COPY spotbugs-exclude.xml ./   # uncomment nếu enable SpotBugs (folder 13 optional)

# Package JAR (skip test).
# Test phải chạy ở CI / local — KHÔNG chạy trong Docker build vì:
# - Testcontainers cần Docker daemon (Docker-in-Docker problem).
# - Production image build không nên phụ thuộc test environment.
# Spotless + Checkstyle bind vào phase 'validate' → vẫn enforce khi 'package'.
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -ntp package -DskipTests

# Extract layered JAR — Spring Boot 3.x layertools mode
ARG JAR_FILE=target/*.jar
RUN cp ${JAR_FILE} app.jar && \
    java -Djarmode=tools -jar app.jar extract --layers --launcher --destination extracted

# =============================================================================
# Stage 2 — RUNTIME
# =============================================================================
FROM eclipse-temurin:21-jre-alpine AS runtime

# OCI labels — populate qua build-arg ở folder 15 (CI)
ARG VERSION="0.0.1-SNAPSHOT"
ARG BUILD_DATE="unknown"
ARG GIT_COMMIT="unknown"

LABEL org.opencontainers.image.title="Learn PostgreSQL API" \
      org.opencontainers.image.description="Spring Boot + PostgreSQL learning project" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.source="https://github.com/tungph7/learn-postgresql-api" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.authors="TungPH"

# Cài curl/wget cho healthcheck (alpine có wget built-in qua busybox, khỏi cài thêm)
# Cài tini để PID 1 handle signal đúng (graceful shutdown khi SIGTERM)
RUN apk add --no-cache tini

# Tạo user/group không-root, UID 1001
RUN addgroup -S appgroup -g 1001 && \
    adduser -S appuser -G appgroup -u 1001

WORKDIR /app

# Copy 4 layer JAR theo thứ tự ít đổi → đổi nhiều (tối ưu Docker cache)
COPY --from=build --chown=1001:1001 /app/extracted/dependencies/ ./
COPY --from=build --chown=1001:1001 /app/extracted/spring-boot-loader/ ./
COPY --from=build --chown=1001:1001 /app/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=1001:1001 /app/extracted/application/ ./

USER 1001:1001

# JVM options — container-aware
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 \
               -XX:+UseG1GC \
               -XX:+ExitOnOutOfMemoryError \
               -Djava.security.egd=file:/dev/./urandom"

# One image runs in Development, Staging and Production: the profile comes from SPRING_PROFILES_ACTIVE of the secrets
# file of each environment on the VPS (env: of .ai-orchestrator/deploy.yaml), and is dev when unset.
EXPOSE 3001

# Healthcheck — wget có sẵn ở alpine busybox; the app listens on PORT, 3001 when unset.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider "http://localhost:${PORT:-3001}/actuator/health/liveness" || exit 1

# tini PID 1 → graceful SIGTERM forwarding cho JVM
ENTRYPOINT ["/sbin/tini", "--", "sh", "-c", "exec java $JAVA_OPTS org.springframework.boot.loader.launch.JarLauncher"]