import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  emptyGraphicsLink,
  isRankPromotionType,
  MLM_SELECT_TYPES,
  RANK_PROMOTION_TYPES,
} from "../src/Pages/Templates/Constant.js";

const addTemplateSource = readFileSync(
  new URL("../src/Pages/Templates/Forms/AddTemplate.jsx", import.meta.url),
  "utf8",
);
const editTemplateSource = readFileSync(
  new URL("../src/Pages/Templates/Forms/EditTemplate.jsx", import.meta.url),
  "utf8",
);
const graphicsRowsSource = readFileSync(
  new URL("../src/Pages/Templates/GraphicsLinkRow.jsx", import.meta.url),
  "utf8",
);

test("Rank Promotion B and C use the same Add/Edit graphics configuration as Rank Promotion", () => {
  assert.deepEqual(RANK_PROMOTION_TYPES, [
    "Rank_Promotion",
    "Rank_Promotion_B",
    "Rank_Promotion_C",
  ]);
  assert.equal(isRankPromotionType("Rank_Promotion"), true);
  assert.equal(isRankPromotionType("Rank_Promotion_B"), true);
  assert.equal(isRankPromotionType("Rank_Promotion_C"), true);
  assert.equal(isRankPromotionType("Achievements"), false);
  assert.ok(
    MLM_SELECT_TYPES.some(
      ({ name, value }) =>
        name === "Rank Promotion C" && value === "Rank_Promotion_C",
    ),
  );
  assert.match(addTemplateSource, /<GraphicsLinksField/);
  assert.match(editTemplateSource, /<GraphicsLinksField/);
  assert.match(
    graphicsRowsSource,
    /canShowRankNameImage = isRankPromotionType\(selType\)/,
  );
});

test("rank promotion graphics links persist both profile mute image fields", () => {
  const graphicsLink = emptyGraphicsLink();
  assert.equal(graphicsLink.mute_footer, "");
  assert.equal(graphicsLink.mute_income, "");

  assert.match(
    graphicsRowsSource,
    /canShowProfileMuteImages = isRankPromotionType\(selType\)/,
  );
  assert.match(graphicsRowsSource, /\{canShowProfileMuteImages && \(/);
  assert.match(graphicsRowsSource, /Profile Mute Footer Image/);
  assert.match(graphicsRowsSource, /update\("mute_footer", v\)/);
  assert.match(graphicsRowsSource, /templates\/profile-mute-footer/);
  assert.match(graphicsRowsSource, /Profile Mute This Week Income Image/);
  assert.match(graphicsRowsSource, /update\("mute_income", v\)/);
  assert.match(graphicsRowsSource, /templates\/profile-mute-income/);

  const badgeField = graphicsRowsSource.indexOf(
    "<FieldLabel>{bannerLabel}</FieldLabel>",
  );
  const footerField = graphicsRowsSource.indexOf("Profile Mute Footer Image");
  const incomeField = graphicsRowsSource.indexOf(
    "Profile Mute This Week Income Image",
  );
  assert.ok(badgeField >= 0 && badgeField < footerField);
  assert.ok(footerField < incomeField);
});
