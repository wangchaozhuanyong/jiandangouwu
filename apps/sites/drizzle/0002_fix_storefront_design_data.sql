UPDATE `hero_translations`
SET
  `eyebrow` = replace(`eyebrow`, '\n', char(10)),
  `title` = replace(`title`, '\n', char(10)),
  `body` = replace(`body`, '\n', char(10)),
  `cta` = replace(`cta`, '\n', char(10))
WHERE
  instr(`eyebrow`, '\n') > 0
  OR instr(`title`, '\n') > 0
  OR instr(`body`, '\n') > 0
  OR instr(`cta`, '\n') > 0;
--> statement-breakpoint

UPDATE `site_settings`
SET
  `value_json` = json_set(`value_json`, '$.transitServiceEnabled', json('true')),
  `version` = `version` + 1,
  `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE
  `key` = 'storefront.settings'
  AND `version` = 1
  AND `updated_by_email` IS NULL
  AND json_extract(`value_json`, '$.transitServiceEnabled') = 0;
