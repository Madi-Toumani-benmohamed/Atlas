ALTER TABLE price_observations DROP CONSTRAINT price_observations_source_type_check;
ALTER TABLE price_observations ADD CONSTRAINT price_observations_source_type_check CHECK(source_type IN ('manual','ecb'));
ALTER TABLE price_observations ADD COLUMN reference_date date;
CREATE UNIQUE INDEX ecb_observation_unique ON price_observations(user_id,currency,reference_date,value,source_type) WHERE source_type='ecb';
INSERT INTO atlas_schema(version) VALUES(5);
