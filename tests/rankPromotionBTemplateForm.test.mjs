import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isRankPromotionType,
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

test("Rank Promotion B uses the same Add/Edit graphics configuration as Rank Promotion", () => {
  assert.deepEqual(RANK_PROMOTION_TYPES, [
    "Rank_Promotion",
    "Rank_Promotion_B",
  ]);
  assert.equal(isRankPromotionType("Rank_Promotion"), true);
  assert.equal(isRankPromotionType("Rank_Promotion_B"), true);
  assert.equal(isRankPromotionType("Achievements"), false);
  assert.match(addTemplateSource, /<GraphicsLinksField/);
  assert.match(editTemplateSource, /<GraphicsLinksField/);
  assert.match(
    graphicsRowsSource,
    /canShowRankNameImage = isRankPromotionType\(selType\)/,
  );
});
