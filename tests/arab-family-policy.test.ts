import assert from "node:assert/strict";
import test from "node:test";

import {
  ARAB_FAMILY_POLICY_LABEL_AR,
  ARAB_FAMILY_POLICY_NOTICE_AR,
  createArabFamilyProfile,
  getArabFamilyCategoryLimits,
} from "../lib/arab-family-policy.ts";

test("Arab family defaults are category-specific rather than a copied foreign age rating", () => {
  const age11 = getArabFamilyCategoryLimits(11);
  assert.equal(age11.violence, 2);
  assert.equal(age11.fear, 2);
  assert.equal(age11.sexualContent, 1);
  assert.equal(age11.language, 1);
  assert.equal(age11.substances, 0);
  assert.equal(age11.selfHarm, 1);

  const age17 = getArabFamilyCategoryLimits(17);
  assert.equal(age17.violence, 4);
  assert.equal(age17.sexualContent, 3);
  assert.equal(age17.language, 3);
  assert.equal(age17.substances, 2);
});

test("Arab family profile remains editable by the family", () => {
  const profile = createArabFamilyProfile({
    childAge: 10,
    fearLimit: 0,
    avoidBullying: false,
  });

  assert.equal(profile.childAge, 10);
  assert.equal(profile.maxSeverity.fear, 0);
  assert.notEqual(profile.maxSeverity.bullying, 0);
  assert.deepEqual(profile.blockedFlags, []);
});

test("Arab policy is explicitly editorial, not an official universal Arab rating", () => {
  assert.match(ARAB_FAMILY_POLICY_LABEL_AR, /الأسرة العربية/);
  assert.match(ARAB_FAMILY_POLICY_NOTICE_AR, /ليست تصنيفًا حكوميًا موحدًا/);
  assert.match(ARAB_FAMILY_POLICY_NOTICE_AR, /تعديل حدودها/);
});

test("Arab family policy rejects impossible ages", () => {
  assert.throws(() => getArabFamilyCategoryLimits(2), /between 3 and 18/);
  assert.throws(() => getArabFamilyCategoryLimits(19), /between 3 and 18/);
  assert.throws(() => getArabFamilyCategoryLimits(10.5), /between 3 and 18/);
});
