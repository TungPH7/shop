package com.tungph7.learnpostgres.feature.product.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.tungph7.learnpostgres.AbstractContainerBaseTest;

/**
 * ADR-0002: {@link ProductSearchTerms#fold} folds exactly as {@code app.search_fold} of V4, so a
 * keyword and the {@code name_search} of a name meet. Both run on the same names: accents of
 * Vietnamese and other languages, upper case, symbols, other scripts, and characters whose case or
 * decomposition could tell Java and PostgreSQL apart.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ProductSearchFoldIntegrationTest extends AbstractContainerBaseTest {

  @Autowired DataSource dataSource;

  private JdbcClient jdbc;

  @BeforeEach
  void setUp() {
    jdbc = JdbcClient.create(dataSource);
  }

  @ParameterizedTest(name = "[{0}]")
  @ValueSource(
      strings = {
        // The five products of SHOP-12 and the examples of the SPEC
        "Áo thun cổ tròn",
        "Quần jean nam",
        "Đầm maxi đỏ 2026",
        "Combo 3 áo thun",
        "Bao tay len",
        "Quần jean (Nam) – Slim",
        "Áo khoác thun nỉ",
        // Upper case and every Vietnamese vowel with every tone
        "ĐẦM MAXI ĐỎ",
        "àáảãạ ăằắẳẵặ âầấẩẫậ èéẻẽẹ êềếểễệ ìíỉĩị òóỏõọ ôồốổỗộ ơờớởỡợ ùúủũụ ưừứửữự ỳýỷỹỵ đ",
        "ÀÁẢÃẠ ĂẰẮẲẴẶ ÂẦẤẨẪẬ ÈÉẺẼẸ ÊỀẾỂỄỆ ÌÍỈĨỊ ÒÓỎÕỌ ÔỒỐỔỖỘ ƠỜỚỞỠỢ ÙÚỦŨỤ ƯỪỨỬỮỰ ỲÝỶỸỴ Đ",
        // Decomposed accents, as some keyboards send them
        "A\u0301o thun co\u0302\u0309 tro\u0300n Đa\u0300m",
        // Symbols, spaces and the characters of LIKE
        "  100% cotton_x\\y'z  ",
        "Giảm 50%!!! (Hè) — chỉ\thôm\nnay",
        "\u00a0Áo\u3000thun\u200b",
        "!!!",
        "",
        // Other languages and scripts
        "Ærøskøbing Straße façade naïve",
        "İstanbul ıiİI",
        "Ωmega Ω K Å",
        "Ǆemal ﬁle Ａｂｃ ¹²³ ½",
        "Москва Αθήνα 東京 서울",
        "Áo 👕 thun 🧥",
        "Āō ǖ ḗ"
      })
  void fold_ofJava_equalsAppSearchFoldOfTheDatabase(String name) {
    String database =
        jdbc.sql("SELECT app.search_fold(:name)").param("name", name).query(String.class).single();

    assertThat(ProductSearchTerms.fold(name)).isEqualTo(database);
  }

  @ParameterizedTest(name = "[{0}]")
  @ValueSource(strings = {"Áo thun cổ tròn", "ĐẦM Maxi đỏ 2026", "Quần jean (Nam) – Slim"})
  void nameSearch_ofAProduct_isTheFoldOfJavaBetweenTwoSpaces(String name) {
    UUID id = UUID.randomUUID();
    jdbc.sql(
            """
            INSERT INTO app.products (id, name, slug, price_vnd)
            VALUES (:id, :name, :slug, 250000)
            """)
        .param("id", id)
        .param("name", name)
        .param("slug", "fold-" + id)
        .update();

    String nameSearch =
        jdbc.sql("SELECT name_search FROM app.products WHERE id = :id")
            .param("id", id)
            .query(String.class)
            .single();

    assertThat(nameSearch).isEqualTo(" " + ProductSearchTerms.fold(name) + " ");
  }
}
