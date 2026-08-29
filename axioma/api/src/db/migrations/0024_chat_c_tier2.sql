-- Tier 2 C: demonstrate the typed request path on a fresh database.
INSERT INTO forms (id, key, version, name, description, status, published_at)
VALUES ('form-laptop-request', 'laptop-request', 1, 'New laptop request', 'Equipment request details', 'published', now())
ON CONFLICT (key, version) DO NOTHING;
INSERT INTO form_fields (id, form_id, key, label, type, ordinal, is_mandatory)
VALUES ('field-laptop-model', 'form-laptop-request', 'model', 'Preferred model', 'text', 0, true)
ON CONFLICT (form_id, key) DO NOTHING;
UPDATE service_subcategories SET form_id = 'form-laptop-request' WHERE id = 'ss-account' AND form_id IS NULL;
UPDATE services SET sla_id = 'default-sla' WHERE id = 'svc-device' AND sla_id IS NULL;
