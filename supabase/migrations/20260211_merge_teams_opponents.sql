-- Migration: Merge Opponents into Teams

-- 1. Add new column to games to link to teams
ALTER TABLE "public"."games" ADD COLUMN IF NOT EXISTS "opponent_team_id" UUID REFERENCES "public"."teams"("id");

-- 2. Migrate data
DO $$
DECLARE
    opp_record RECORD;
    new_team_id UUID;
BEGIN
    FOR opp_record IN SELECT * FROM "public"."opponents" LOOP
        -- Check if a team already exists for this opponent (linked via the old opponent_id column)
        SELECT "id" INTO new_team_id FROM "public"."teams" WHERE "opponent_id" = opp_record.id LIMIT 1;

        -- If not exists, create a new team based on opponent data
        IF new_team_id IS NULL THEN
            INSERT INTO "public"."teams" ("name", "city", "country", "created_at", "is_propeleri")
            VALUES (opp_record.name, opp_record.city, opp_record.country, opp_record.created_at, false)
            RETURNING "id" INTO new_team_id;
        ELSE 
            -- Update existing team with missing info if needed
            UPDATE "public"."teams" 
            SET 
                "country" = COALESCE("country", opp_record.country),
                "city" = COALESCE("city", opp_record.city)
            WHERE "id" = new_team_id;
        END IF;

        -- Update games to point to this team
        UPDATE "public"."games"
        SET "opponent_team_id" = new_team_id
        WHERE "opponent_id" = opp_record.id;
    END LOOP;
END $$;

-- 3. Cleanup: Remove old columns and table
-- Note: We are removing the relationship capabilities to the old table
-- ALTER TABLE "public"."teams" DROP COLUMN IF EXISTS "opponent_id";
-- ALTER TABLE "public"."games" DROP COLUMN IF EXISTS "opponent_id";
-- ALTER TABLE "public"."games" DROP COLUMN IF EXISTS "opponent";
-- DROP TABLE IF EXISTS "public"."opponents";
