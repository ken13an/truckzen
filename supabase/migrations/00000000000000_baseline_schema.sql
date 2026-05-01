-- Baseline canonical schema for local Supabase bootstrap.
-- Generated from /tmp/truckzen_schema.sql by build_baseline.py.
-- Idempotent / additive only. Safe to re-apply.
-- Excludes indexes, triggers, policies and RLS enables; those are
-- added by the existing delta migrations on top of this baseline.
-- Has no effect on remote Supabase: every existing remote environment
-- already has these objects, and every statement is wrapped to no-op
-- when the object already exists.
--
-- Statement order: extensions, schemas, types, sequences, tables,
-- alter sequence, alter table (PK/FK/UNIQUE), then functions. SQL
-- functions need their referenced tables to exist at create time.

-- ==== schemas ====
CREATE SCHEMA IF NOT EXISTS "public";


-- ==== types ====
DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."asset_status" AS ENUM (
    'on_road',
    'in_shop',
    'out_of_service',
    'retired'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."compliance_type" AS ENUM (
    'dot_inspection',
    'registration',
    'insurance',
    'ifta',
    'irp',
    'cdl',
    'medical_cert',
    'other'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."dvir_type" AS ENUM (
    'pre_trip',
    'post_trip'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'void'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."mechanic_language" AS ENUM (
    'en',
    'ru',
    'uz',
    'es'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."mwo_status" AS ENUM (
    'open',
    'in_progress',
    'waiting_parts',
    'done',
    'cancelled'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."mwo_type" AS ENUM (
    'pm_service',
    'dot_inspection',
    'fault_code',
    'dvir_defect',
    'corrective',
    'warranty'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."part_category" AS ENUM (
    'engine',
    'electrical',
    'brakes',
    'filters_fluids',
    'body_chassis',
    'tires',
    'lights',
    'transmission',
    'other'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."so_priority" AS ENUM (
    'low',
    'normal',
    'high',
    'critical'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."so_source" AS ENUM (
    'walk_in',
    'phone',
    'kiosk',
    'portal',
    'telegram',
    'fullbay',
    'fleetio',
    'csv_import',
    'truckzen'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."so_status" AS ENUM (
    'draft',
    'not_approved',
    'waiting_approval',
    'in_progress',
    'waiting_parts',
    'done',
    'ready_final_inspection',
    'good_to_go',
    'failed_inspection',
    'void'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;

DO $TZ_BASELINE$ BEGIN
CREATE TYPE "public"."user_role" AS ENUM (
    'owner',
    'gm',
    'it_person',
    'shop_manager',
    'service_advisor',
    'service_writer',
    'technician',
    'parts_manager',
    'fleet_manager',
    'maintenance_manager',
    'maintenance_technician',
    'accountant',
    'office_admin',
    'dispatcher',
    'driver',
    'customer',
    'lead_tech'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $TZ_BASELINE$;


-- ==== sequences ====
CREATE SEQUENCE IF NOT EXISTS "public"."so_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS "public"."wo_number_seq"
    START WITH 123463
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ==== tables ====
CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "team" "text",
    "language" "public"."mechanic_language" DEFAULT 'en'::"public"."mechanic_language",
    "avatar_color" "text" DEFAULT 'linear-gradient(135deg,#1D6FE8,#1248B0)'::"text",
    "telegram_id" bigint,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "can_create_so" boolean DEFAULT false,
    "supervisor_teams" "text"[] DEFAULT '{}'::"text"[],
    "can_impersonate" boolean DEFAULT false,
    "impersonate_role" "text",
    "is_platform_owner" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "skills" "text"[] DEFAULT '{}'::"text"[],
    "availability" character varying DEFAULT 'available'::character varying,
    "push_token" "text",
    "is_test_data" boolean DEFAULT false,
    "session_token" "uuid",
    "session_updated_at" timestamp with time zone,
    "totp_secret" "text",
    "totp_enabled" boolean DEFAULT false,
    "totp_verified_at" timestamp with time zone,
    "department" "text",
    "is_autobot" boolean DEFAULT false,
    "invite_token" "text",
    "invite_expires_at" timestamp with time zone,
    "invite_accepted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."ai_usage_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "feature" "text" NOT NULL,
    "model" "text" DEFAULT 'claude-sonnet-4-6'::"text",
    "input_tokens" integer DEFAULT 0,
    "output_tokens" integer DEFAULT 0,
    "estimated_cost" numeric(8,6) DEFAULT 0,
    "related_id" "uuid",
    "input_language" "text",
    "success" boolean DEFAULT true,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tokens_in" integer DEFAULT 0,
    "tokens_out" integer DEFAULT 0,
    "total_tokens" integer DEFAULT 0,
    "request_duration_ms" integer
);

CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "key_hash" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid",
    "permissions" "text"[] DEFAULT ARRAY['read'::"text"],
    "rate_limit" integer DEFAULT 100,
    "last_used_at" timestamp with time zone,
    "request_count" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."asset_external_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_secondary_id" "text",
    "match_method" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "unit_number" "text" NOT NULL,
    "asset_type" "text" DEFAULT 'truck'::"text",
    "status" "public"."asset_status" DEFAULT 'on_road'::"public"."asset_status",
    "year" integer,
    "make" "text",
    "model" "text",
    "vin" "text",
    "license_plate" "text",
    "license_state" "text",
    "engine_make" "text",
    "engine_model" "text",
    "engine_hp" integer,
    "transmission" "text",
    "odometer" integer DEFAULT 0,
    "engine_hours" numeric(10,1) DEFAULT 0,
    "customer_id" "uuid",
    "assigned_driver" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "engine" "text",
    "ownership_type" "text" DEFAULT 'fleet_asset'::"text",
    "unit_type" character varying DEFAULT 'tractor'::character varying,
    "warranty_start" "date",
    "warranty_end" "date",
    "warranty_notes" "text",
    "next_oil_change_miles" integer,
    "next_dot_inspection" "date",
    "last_service_date" "date",
    "total_spend" numeric(10,2) DEFAULT 0,
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "deleted_at" timestamp without time zone,
    "is_test_data" boolean DEFAULT false,
    "is_owner_operator" boolean DEFAULT false,
    "contact_email" character varying,
    "contact_phone" character varying,
    "import_batch_id" "uuid",
    "fullbay_id" character varying,
    "external_data" "jsonb",
    "warranty_provider" "text",
    "warranty_expiry" "date",
    "warranty_mileage_limit" integer,
    "warranty_coverage_type" "text",
    "vehicle_status" character varying DEFAULT 'active'::character varying,
    "owner_name" "text",
    "owner_phone" "text",
    "driver_name" "text",
    "driver_phone" "text",
    "lease_info" "text",
    "asset_status" "text" DEFAULT 'active'::"text",
    "last_lat" double precision,
    "last_lng" double precision,
    "last_gps_update" timestamp with time zone,
    CONSTRAINT "assets_ownership_type_check" CHECK (("ownership_type" = ANY (ARRAY['fleet_asset'::"text", 'owner_operator'::"text", 'outside_customer'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."assets_backup_fleet_import" (
    "id" "uuid",
    "shop_id" "uuid",
    "unit_number" "text",
    "asset_type" "text",
    "status" "public"."asset_status",
    "year" integer,
    "make" "text",
    "model" "text",
    "vin" "text",
    "license_plate" "text",
    "license_state" "text",
    "engine_make" "text",
    "engine_model" "text",
    "engine_hp" integer,
    "transmission" "text",
    "odometer" integer,
    "engine_hours" numeric(10,1),
    "customer_id" "uuid",
    "assigned_driver" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "engine" "text",
    "ownership_type" "text",
    "unit_type" character varying,
    "warranty_start" "date",
    "warranty_end" "date",
    "warranty_notes" "text",
    "next_oil_change_miles" integer,
    "next_dot_inspection" "date",
    "last_service_date" "date",
    "total_spend" numeric(10,2),
    "source" character varying,
    "external_id" character varying,
    "deleted_at" timestamp without time zone,
    "is_test_data" boolean,
    "is_owner_operator" boolean,
    "contact_email" character varying,
    "contact_phone" character varying,
    "import_batch_id" "uuid",
    "fullbay_id" character varying,
    "external_data" "jsonb",
    "warranty_provider" "text",
    "warranty_expiry" "date",
    "warranty_mileage_limit" integer,
    "warranty_coverage_type" "text",
    "vehicle_status" character varying
);

CREATE TABLE IF NOT EXISTS "public"."assets_backup_phase2" (
    "id" "uuid",
    "shop_id" "uuid",
    "unit_number" "text",
    "asset_type" "text",
    "status" "public"."asset_status",
    "year" integer,
    "make" "text",
    "model" "text",
    "vin" "text",
    "license_plate" "text",
    "license_state" "text",
    "engine_make" "text",
    "engine_model" "text",
    "engine_hp" integer,
    "transmission" "text",
    "odometer" integer,
    "engine_hours" numeric(10,1),
    "customer_id" "uuid",
    "assigned_driver" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "engine" "text",
    "ownership_type" "text",
    "unit_type" character varying,
    "warranty_start" "date",
    "warranty_end" "date",
    "warranty_notes" "text",
    "next_oil_change_miles" integer,
    "next_dot_inspection" "date",
    "last_service_date" "date",
    "total_spend" numeric(10,2),
    "source" character varying,
    "external_id" character varying,
    "deleted_at" timestamp without time zone,
    "is_test_data" boolean,
    "is_owner_operator" boolean,
    "contact_email" character varying,
    "contact_phone" character varying,
    "import_batch_id" "uuid",
    "fullbay_id" character varying,
    "external_data" "jsonb",
    "warranty_provider" "text",
    "warranty_expiry" "date",
    "warranty_mileage_limit" integer,
    "warranty_coverage_type" "text",
    "vehicle_status" character varying,
    "owner_name" "text",
    "owner_phone" "text",
    "driver_name" "text",
    "driver_phone" "text",
    "lease_info" "text",
    "asset_status" "text"
);

CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text",
    "record_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "ip_address" "inet",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_email" "text",
    "user_role" "text",
    "changed_fields" "text"[],
    "entity_type" "text",
    "entity_id" "text",
    "details" "jsonb"
);

CREATE TABLE IF NOT EXISTS "public"."autobot_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_preset" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."autobot_test_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scenario_name" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "total_steps" integer DEFAULT 0,
    "passed_steps" integer DEFAULT 0,
    "failed_steps" integer DEFAULT 0,
    "status" "text" DEFAULT 'running'::"text",
    "steps_detail" "jsonb" DEFAULT '[]'::"jsonb",
    "run_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."autobots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text",
    "auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deployed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."blocked_ips" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ip_address" "inet" NOT NULL,
    "reason" "text",
    "blocked_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "created_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."build_progress" (
    "id" character varying NOT NULL,
    "phase" character varying NOT NULL,
    "label" character varying NOT NULL,
    "done" boolean DEFAULT false,
    "note" character varying,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."cleaning_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "assigned_to" "uuid" NOT NULL,
    "supervisor" "uuid",
    "status" "text" DEFAULT 'in_progress'::"text",
    "checklist_state" "jsonb" DEFAULT '{}'::"jsonb",
    "items_total" integer DEFAULT 0,
    "items_done" integer DEFAULT 0,
    "score" integer,
    "notes" "text",
    "photo_urls" "text"[] DEFAULT '{}'::"text"[],
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "signed_off_at" timestamp with time zone,
    "duration_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cleaning_sessions_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'signed_off'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."cleaning_zones" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text" DEFAULT '🔧'::"text",
    "teams" "text"[] DEFAULT '{}'::"text"[],
    "bays" "text",
    "checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."compliance_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "driver_id" "uuid",
    "item_type" "public"."compliance_type" NOT NULL,
    "document_name" "text" NOT NULL,
    "expiry_date" "date" NOT NULL,
    "reminder_days" integer DEFAULT 30,
    "alert_sent" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."core_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "wo_id" "uuid",
    "so_line_id" "uuid",
    "new_part_name" "text" NOT NULL,
    "new_part_number" "text",
    "core_part_name" "text" NOT NULL,
    "core_part_number" "text",
    "core_status" "text" DEFAULT 'pending_removal'::"text",
    "removed_at" timestamp with time zone,
    "removed_by" "uuid",
    "received_by_parts" "uuid",
    "received_by_parts_at" timestamp with time zone,
    "storage_location" "text",
    "shipped_at" timestamp with time zone,
    "shipped_to" "text",
    "tracking_number" "text",
    "return_deadline" "date",
    "credit_amount" numeric(10,2),
    "credit_received_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "core_parts_core_status_check" CHECK (("core_status" = ANY (ARRAY['pending_removal'::"text", 'removed'::"text", 'stored'::"text", 'shipped'::"text", 'credit_received'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."customer_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "full_name" character varying NOT NULL,
    "role" character varying,
    "phone" character varying,
    "email" character varying,
    "preferred_contact" character varying DEFAULT 'phone'::character varying,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."customer_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "filename" character varying,
    "doc_type" character varying,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_name" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "notes" "text",
    "source" "text" DEFAULT 'walk_in'::"text",
    "visit_count" integer DEFAULT 0,
    "total_spent" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "dot_number" character varying,
    "mc_number" character varying,
    "payment_terms" character varying DEFAULT 'cod'::character varying,
    "credit_limit" numeric(10,2),
    "customer_status" character varying DEFAULT 'active'::character varying,
    "default_auth_type" character varying DEFAULT 'estimate_first'::character varying,
    "default_auth_limit" numeric(10,2),
    "internal_tags" "text"[] DEFAULT '{}'::"text"[],
    "billing_address" "text",
    "notes_internal" "text",
    "portal_token" "uuid" DEFAULT "gen_random_uuid"(),
    "external_id" character varying,
    "deleted_at" timestamp without time zone,
    "deleted_by" "uuid",
    "deletion_reason" "text",
    "portal_consent" boolean DEFAULT false,
    "portal_consent_date" timestamp without time zone,
    "is_test_data" boolean DEFAULT false,
    "customer_type" character varying DEFAULT 'company'::character varying,
    "is_owner_operator" boolean DEFAULT false,
    "external_data" "jsonb",
    "is_fleet" boolean DEFAULT false,
    "default_ownership_type" character varying DEFAULT 'fleet_asset'::character varying,
    "sms_opted_out" boolean DEFAULT false,
    "email_opted_out" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "public"."data_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "request_type" character varying NOT NULL,
    "status" character varying DEFAULT 'pending'::character varying,
    "reason" "text",
    "requested_at" timestamp without time zone DEFAULT "now"(),
    "processed_at" timestamp without time zone,
    "processed_by" "uuid",
    "notes" "text"
);

CREATE TABLE IF NOT EXISTS "public"."drivers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "cdl_number" "text",
    "cdl_class" "text" DEFAULT 'A'::"text",
    "cdl_expiry" "date",
    "medical_expiry" "date",
    "hire_date" "date",
    "assigned_unit" "uuid",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."dvir_submissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "driver_id" "uuid",
    "dvir_type" "public"."dvir_type" NOT NULL,
    "odometer" integer,
    "engine_hours" numeric(10,1),
    "has_defects" boolean DEFAULT false,
    "defects" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "signature_url" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."employee_payroll" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pay_type" character varying DEFAULT 'hourly'::character varying NOT NULL,
    "hourly_rate" numeric(10,2) DEFAULT 0,
    "salary_amount" numeric(10,2) DEFAULT 0,
    "weekly_hours" numeric(5,2) DEFAULT 40,
    "effective_date" "date" DEFAULT CURRENT_DATE,
    "notes" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."employee_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "manager_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."estimate_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "estimate_id" "uuid" NOT NULL,
    "repair_order_line_id" "uuid",
    "description" "text" NOT NULL,
    "complaint" "text",
    "labor_hours" numeric(6,2) DEFAULT 0,
    "labor_rate" numeric(8,2) DEFAULT 0,
    "labor_total" numeric(10,2) DEFAULT 0,
    "parts_total" numeric(10,2) DEFAULT 0,
    "line_total" numeric(10,2) DEFAULT 0,
    "is_approved" boolean,
    "customer_response" "text",
    "line_number" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."estimates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "repair_order_id" "uuid" NOT NULL,
    "estimate_number" "text" NOT NULL,
    "customer_id" "uuid",
    "customer_name" "text",
    "customer_email" "text",
    "customer_phone" "text",
    "labor_total" numeric(10,2) DEFAULT 0,
    "parts_total" numeric(10,2) DEFAULT 0,
    "subtotal" numeric(10,2) DEFAULT 0,
    "tax_amount" numeric(10,2) DEFAULT 0,
    "total" numeric(10,2) DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "sent_at" timestamp with time zone,
    "sent_via" "text",
    "viewed_at" timestamp with time zone,
    "responded_at" timestamp with time zone,
    "approved_by" "text",
    "approval_signature" "text",
    "approval_token" "uuid" DEFAULT "gen_random_uuid"(),
    "valid_until" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "wo_id" "uuid",
    "grand_total" numeric(10,2) DEFAULT 0,
    "misc_total" numeric(10,2) DEFAULT 0,
    "discount_total" numeric(10,2) DEFAULT 0,
    "tax_rate" numeric(5,2) DEFAULT 0,
    "sent_to_email" "text",
    "approved_at" timestamp with time zone,
    "approved_by_name" "text",
    "declined_at" timestamp with time zone,
    "decline_reason" "text",
    "internal_notes" "text",
    "created_by" "uuid",
    "asset_id" "uuid",
    "approval_method" "text",
    "deleted_at" timestamp with time zone,
    "customer_notes" "text",
    "pdf_sent_at" timestamp with time zone,
    "pdf_storage_path" "text",
    CONSTRAINT "estimates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'viewed'::"text", 'approved'::"text", 'partially_approved'::"text", 'declined'::"text", 'expired'::"text", 'void'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."fullbay_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "sync_type" character varying NOT NULL,
    "status" character varying DEFAULT 'running'::character varying,
    "records_pulled" integer DEFAULT 0,
    "records_imported" integer DEFAULT 0,
    "records_skipped" integer DEFAULT 0,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "triggered_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."fullbay_sync_state" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" character varying NOT NULL,
    "last_synced_id" character varying,
    "last_synced_at" timestamp with time zone,
    "total_synced" integer DEFAULT 0,
    "status" character varying DEFAULT 'pending'::character varying,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."import_export_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_name" "text",
    "action" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "record_count" integer DEFAULT 0,
    "created_count" integer DEFAULT 0,
    "skipped_count" integer DEFAULT 0,
    "error_count" integer DEFAULT 0,
    "file_name" "text",
    "record_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "undone" boolean DEFAULT false,
    "undone_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "import_export_log_action_check" CHECK (("action" = ANY (ARRAY['import'::"text", 'export'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."import_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "import_type" character varying NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "total_rows" integer DEFAULT 0,
    "imported_rows" integer DEFAULT 0,
    "skipped_rows" integer DEFAULT 0,
    "status" character varying DEFAULT 'completed'::character varying,
    "error_report" "jsonb",
    "imported_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "undo_available_until" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."invoice_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "repair_order_line_id" "uuid",
    "line_type" "text" DEFAULT 'labor'::"text",
    "description" "text" NOT NULL,
    "quantity" numeric(8,2) DEFAULT 1,
    "unit_price" numeric(10,2) DEFAULT 0,
    "line_total" numeric(10,2) DEFAULT 0,
    "is_taxable" boolean DEFAULT true,
    "line_number" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "invoice_lines_line_type_check" CHECK (("line_type" = ANY (ARRAY['labor'::"text", 'parts'::"text", 'supplies'::"text", 'fee'::"text", 'discount'::"text", 'other'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."invoice_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "shop_id" "uuid" NOT NULL,
    "payment_method" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "reference_number" "text",
    "received_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "so_id" "uuid",
    "customer_id" "uuid",
    "status" "public"."invoice_status" DEFAULT 'draft'::"public"."invoice_status",
    "subtotal" numeric(10,2) DEFAULT 0,
    "tax_amount" numeric(10,2) DEFAULT 0,
    "total" numeric(10,2) DEFAULT 0,
    "amount_paid" numeric(10,2) DEFAULT 0,
    "balance_due" numeric(10,2) GENERATED ALWAYS AS (("total" - "amount_paid")) STORED,
    "payment_method" "text",
    "stripe_payment_intent" "text",
    "due_date" "date",
    "paid_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "qbo_invoice_id" "text",
    "qbo_synced" boolean DEFAULT false,
    "source" character varying DEFAULT 'truckzen'::character varying,
    "is_historical" boolean DEFAULT false,
    "original_invoice_number" character varying,
    "deleted_at" timestamp without time zone
);

CREATE TABLE IF NOT EXISTS "public"."job_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "so_line_id" "uuid" NOT NULL,
    "assigned_to_user_id" "uuid" NOT NULL,
    "assigned_by_user_id" "uuid",
    "assigned_at" timestamp without time zone DEFAULT "now"(),
    "status" character varying DEFAULT 'pending'::character varying,
    "accepted_at" timestamp without time zone,
    "completed_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "declined_at" timestamp without time zone,
    "decline_reason" "text"
);

CREATE TABLE IF NOT EXISTS "public"."job_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "complaint_template" "text",
    "estimated_hours" numeric(6,2),
    "suggested_parts" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."kiosk_checkins" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "customer_id" "uuid",
    "unit_number" "text",
    "complaint_raw" "text",
    "complaint_lang" "text",
    "complaint_en" "text",
    "checkin_ref" "text" NOT NULL,
    "converted_so_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text",
    "company_name" "text",
    "contact_name" "text",
    "phone" "text",
    "email" "text",
    "odometer" integer,
    "vin" "text",
    "parked_location" character varying,
    "keys_left" character varying,
    "staying" boolean,
    "need_by_date" "date",
    "priority" character varying DEFAULT 'routine'::character varying,
    "auth_type" character varying DEFAULT 'estimate_first'::character varying,
    "auth_limit" numeric(10,2),
    "contact_email" character varying,
    "contact_phone" character varying,
    "portal_token" "uuid" DEFAULT "gen_random_uuid"(),
    "wo_id" "uuid",
    "concern_text" "text",
    "customer_type" character varying DEFAULT 'company'::character varying,
    "concern_text_original" "text",
    "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."kiosk_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "company_name" character varying,
    "unit_number" character varying,
    "vin" character varying,
    "contact_name" character varying,
    "contact_phone" character varying,
    "concern" "text",
    "concern_ai" "text",
    "mileage" integer,
    "priority" character varying DEFAULT 'normal'::character varying,
    "status" character varying DEFAULT 'pending'::character varying,
    "converted_to_so_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "privacy_consent" boolean DEFAULT false,
    "consent_timestamp" timestamp without time zone,
    "consent_ip" character varying
);

CREATE TABLE IF NOT EXISTS "public"."login_attempts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "ip_address" "inet",
    "success" boolean NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_name" character varying,
    "activity_type" character varying NOT NULL,
    "entity_type" character varying,
    "entity_id" "uuid",
    "entity_label" character varying,
    "message" "text" NOT NULL,
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_contact_renewals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "driver_id" "uuid",
    "renewal_type" character varying NOT NULL,
    "custom_name" character varying,
    "expiry_date" "date" NOT NULL,
    "reminder_days_before" integer DEFAULT 30,
    "status" character varying DEFAULT 'active'::character varying,
    "renewed_date" "date",
    "cost" numeric(12,2),
    "document_url" character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "file_name" character varying NOT NULL,
    "file_url" character varying NOT NULL,
    "file_size" integer,
    "file_type" character varying,
    "linked_type" character varying,
    "linked_id" "uuid",
    "category" character varying,
    "uploaded_by" "uuid",
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_driver_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "is_primary" boolean DEFAULT true,
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_driver_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "doc_type" character varying NOT NULL,
    "file_url" character varying,
    "file_name" character varying,
    "expiry_date" "date",
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_drivers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "full_name" character varying NOT NULL,
    "phone" character varying,
    "email" character varying,
    "photo_url" character varying,
    "cdl_number" character varying,
    "cdl_class" character varying DEFAULT 'A'::character varying,
    "cdl_state" character varying,
    "cdl_expiry" "date",
    "cdl_endorsements" character varying,
    "cdl_restrictions" character varying,
    "medical_card_expiry" "date",
    "medical_card_provider" character varying,
    "last_drug_test" "date",
    "next_drug_test_due" "date",
    "drug_test_result" character varying,
    "last_mvr_date" "date",
    "mvr_status" character varying,
    "hire_date" "date",
    "termination_date" "date",
    "active" boolean DEFAULT true,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" character varying NOT NULL,
    "equipment_type" character varying,
    "serial_number" character varying,
    "make" character varying,
    "model" character varying,
    "year" integer,
    "purchase_date" "date",
    "purchase_cost" numeric(12,2),
    "current_value" numeric(12,2),
    "location" character varying,
    "assigned_to" character varying,
    "status" character varying DEFAULT 'active'::character varying,
    "hourmeter" numeric(10,1) DEFAULT 0,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "driver_id" "uuid",
    "expense_type" character varying NOT NULL,
    "description" character varying,
    "amount" numeric(12,2) NOT NULL,
    "expense_date" "date" NOT NULL,
    "receipt_url" character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_faults" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "fault_code" character varying NOT NULL,
    "fault_description" "text",
    "severity" character varying DEFAULT 'warning'::character varying,
    "status" character varying DEFAULT 'open'::character varying,
    "source_system" character varying DEFAULT 'manual'::character varying,
    "first_seen" timestamp with time zone DEFAULT "now"(),
    "last_seen" timestamp with time zone DEFAULT "now"(),
    "occurrence_count" integer DEFAULT 1,
    "resolved" boolean DEFAULT false,
    "resolved_date" timestamp with time zone,
    "resolved_notes" "text",
    "linked_issue_id" "uuid",
    "linked_repair_id" "uuid",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_fuel_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "driver_id" "uuid",
    "fuel_date" "date" NOT NULL,
    "location" character varying,
    "fuel_type" character varying DEFAULT 'diesel'::character varying,
    "gallons" numeric(10,3),
    "price_per_gallon" numeric(8,4),
    "total_cost" numeric(12,2),
    "odometer" integer,
    "mpg" numeric(8,2),
    "full_tank" boolean DEFAULT true,
    "receipt_url" character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_inspection_defects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "inspection_id" "uuid" NOT NULL,
    "category" character varying,
    "description" "text" NOT NULL,
    "severity" character varying DEFAULT 'minor'::character varying,
    "photo_url" character varying,
    "resolved" boolean DEFAULT false,
    "resolved_date" "date",
    "linked_repair_id" "uuid",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_inspection_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" character varying NOT NULL,
    "inspection_type" character varying NOT NULL,
    "checklist" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true,
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "asset_id" "uuid",
    "driver_id" "uuid",
    "inspection_type" character varying NOT NULL,
    "inspection_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "odometer" integer,
    "result" character varying DEFAULT 'pass'::character varying,
    "responses" "jsonb" DEFAULT '{}'::"jsonb",
    "defects_count" integer DEFAULT 0,
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "driver_signature" character varying,
    "mechanic_signature" character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "reported_by" "uuid",
    "issue_number" character varying,
    "title" character varying NOT NULL,
    "description" "text",
    "priority" character varying DEFAULT 'medium'::character varying,
    "status" character varying DEFAULT 'open'::character varying,
    "category" character varying,
    "due_date" "date",
    "resolved_date" timestamp with time zone,
    "resolved_by" character varying,
    "resolution_notes" "text",
    "linked_repair_id" "uuid",
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_meter_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "equipment_id" "uuid",
    "meter_type" character varying DEFAULT 'odometer'::character varying,
    "value" integer NOT NULL,
    "recorded_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recorded_by" character varying,
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "part_number" character varying,
    "description" character varying NOT NULL,
    "category" character varying,
    "cost_price" numeric(12,2) DEFAULT 0,
    "sell_price" numeric(12,2) DEFAULT 0,
    "quantity_on_hand" integer DEFAULT 0,
    "reorder_point" integer DEFAULT 0,
    "vendor_id" "uuid",
    "bin_location" character varying,
    "notes" "text",
    "active" boolean DEFAULT true,
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_places" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" character varying NOT NULL,
    "place_type" character varying DEFAULT 'other'::character varying,
    "address" "text",
    "city" character varying,
    "state" character varying,
    "zip" character varying,
    "latitude" numeric,
    "longitude" numeric,
    "phone" character varying,
    "contact_person" character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_pm_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "pm_schedule_id" "uuid",
    "asset_id" "uuid",
    "service_type" character varying,
    "performed_date" "date" NOT NULL,
    "performed_mileage" integer,
    "performed_by" character varying,
    "cost" numeric(12,2) DEFAULT 0,
    "linked_repair_id" "uuid",
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_pm_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "service_type" character varying NOT NULL,
    "service_name" character varying NOT NULL,
    "interval_type" character varying NOT NULL,
    "interval_value" integer NOT NULL,
    "last_performed_date" "date",
    "last_performed_mileage" integer,
    "next_due_date" "date",
    "next_due_mileage" integer,
    "status" character varying DEFAULT 'on_time'::character varying,
    "auto_create_request" boolean DEFAULT true,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_purchase_order_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "part_id" "uuid",
    "description" character varying NOT NULL,
    "part_number" character varying,
    "quantity_ordered" numeric(10,2) DEFAULT 1,
    "quantity_received" numeric(10,2) DEFAULT 0,
    "unit_cost" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) DEFAULT 0,
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "po_number" character varying,
    "vendor_id" "uuid",
    "linked_repair_id" "uuid",
    "status" character varying DEFAULT 'draft'::character varying,
    "subtotal" numeric(12,2) DEFAULT 0,
    "tax" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) DEFAULT 0,
    "order_date" "date",
    "expected_delivery" "date",
    "received_date" "date",
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_recalls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "recall_number" character varying,
    "nhtsa_id" character varying,
    "title" character varying NOT NULL,
    "description" "text",
    "manufacturer" character varying,
    "status" character varying DEFAULT 'open'::character varying,
    "remedy" "text",
    "completed_date" timestamp with time zone,
    "completed_by" character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_road_repair_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "road_repair_id" "uuid" NOT NULL,
    "line_type" character varying DEFAULT 'labor'::character varying,
    "description" "text",
    "quantity" numeric(10,2) DEFAULT 1,
    "unit_cost" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) DEFAULT 0,
    "part_number" character varying,
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_road_repairs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "repair_number" character varying,
    "asset_id" "uuid",
    "driver_id" "uuid",
    "vendor_id" "uuid",
    "location_description" character varying,
    "description" "text",
    "vendor_invoice_number" character varying,
    "labor_cost" numeric(12,2) DEFAULT 0,
    "parts_cost" numeric(12,2) DEFAULT 0,
    "misc_cost" numeric(12,2) DEFAULT 0,
    "total_cost" numeric(12,2) DEFAULT 0,
    "repair_date" "date",
    "status" character varying DEFAULT 'open'::character varying,
    "priority" character varying DEFAULT 'normal'::character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_service_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "service_type" character varying NOT NULL,
    "interval_miles" integer,
    "interval_days" integer,
    "applies_to" "jsonb" DEFAULT '[]'::"jsonb",
    "active" boolean DEFAULT true,
    "vehicles_count" integer DEFAULT 0,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_service_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "reminder_type" character varying NOT NULL,
    "custom_name" character varying,
    "interval_miles" integer,
    "interval_days" integer,
    "threshold_miles" integer,
    "threshold_days" integer,
    "last_completed_date" "date",
    "last_completed_miles" integer,
    "next_due_date" "date",
    "next_due_miles" integer,
    "status" character varying DEFAULT 'active'::character varying,
    "overdue" boolean DEFAULT false,
    "notification_sent" boolean DEFAULT false,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_vehicle_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "latitude" numeric NOT NULL,
    "longitude" numeric NOT NULL,
    "speed" integer,
    "heading" integer,
    "address" character varying,
    "recorded_at" timestamp with time zone NOT NULL,
    "source" character varying DEFAULT 'samsara'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_vehicle_renewals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "renewal_type" character varying NOT NULL,
    "custom_name" character varying,
    "expiry_date" "date" NOT NULL,
    "reminder_days_before" integer DEFAULT 30,
    "status" character varying DEFAULT 'active'::character varying,
    "renewed_date" "date",
    "cost" numeric(12,2),
    "document_url" character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" character varying NOT NULL,
    "address" character varying,
    "city" character varying,
    "state" character varying,
    "zip" character varying,
    "phone" character varying,
    "email" character varying,
    "contact_person" character varying,
    "vendor_type" character varying,
    "specialties" "text",
    "payment_terms" character varying,
    "tax_id" character varying,
    "notes" "text",
    "active" boolean DEFAULT true,
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_warranties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "warranty_type" character varying NOT NULL,
    "provider" character varying,
    "coverage_description" "text",
    "start_date" "date",
    "end_date" "date",
    "start_miles" integer,
    "end_miles" integer,
    "current_status" character varying DEFAULT 'active'::character varying,
    "claim_count" integer DEFAULT 0,
    "total_claimed" numeric(12,2) DEFAULT 0,
    "document_url" character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maint_warranty_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "warranty_id" "uuid",
    "asset_id" "uuid",
    "claim_date" "date" NOT NULL,
    "description" "text",
    "amount_claimed" numeric(12,2),
    "amount_approved" numeric(12,2),
    "status" character varying DEFAULT 'submitted'::character varying,
    "vendor_id" "uuid",
    "repair_id" "uuid",
    "document_url" character varying,
    "notes" "text",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "external_id" character varying,
    "external_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."maintenance_work_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "mwo_number" "text" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "mwo_type" "public"."mwo_type" DEFAULT 'corrective'::"public"."mwo_type",
    "status" "public"."mwo_status" DEFAULT 'open'::"public"."mwo_status",
    "priority" "public"."so_priority" DEFAULT 'normal'::"public"."so_priority",
    "description" "text" NOT NULL,
    "trigger_type" "text",
    "trigger_value" "text",
    "assigned_to" "uuid",
    "estimated_cost" numeric(10,2),
    "actual_cost" numeric(10,2),
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."mechanic_action_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "so_id" "uuid" NOT NULL,
    "mechanic_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "parts_needed" "jsonb" DEFAULT '[]'::"jsonb",
    "hours_requested" numeric(6,1),
    "assigned_to" "text" DEFAULT 'supervisor'::"text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "response_note" "text",
    "responded_by" "uuid",
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mechanic_action_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['need_parts'::"text", 'need_approval'::"text", 'need_assistance'::"text", 'need_clarification'::"text", 'labor_extension'::"text"]))),
    CONSTRAINT "mechanic_action_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'denied'::"text", 'scheduled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."mechanic_idle_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "mechanic_id" "uuid",
    "supervisor_id" "uuid",
    "alerted_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "resolution" "text"
);

CREATE TABLE IF NOT EXISTS "public"."mechanic_overtime_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "mechanic_id" "uuid",
    "wo_line_id" "uuid",
    "estimated_minutes" integer NOT NULL,
    "elapsed_minutes" integer NOT NULL,
    "alerted_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."mechanic_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "skill_name" "text" NOT NULL,
    "skill_category" "text" NOT NULL,
    "experience_level" "text" DEFAULT 'intermediate'::"text",
    "certified" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mechanic_skills_experience_level_check" CHECK (("experience_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'experienced'::"text", 'expert'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."mechanic_unplanned_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "mechanic_id" "uuid",
    "description" "text" NOT NULL,
    "duration_minutes" integer NOT NULL,
    "category" "text" NOT NULL,
    "logged_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."mechanic_weekly_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "mechanic_id" "uuid",
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "total_hours_worked" numeric(6,2) DEFAULT 0,
    "jobs_completed" integer DEFAULT 0,
    "unplanned_jobs_count" integer DEFAULT 0,
    "idle_time_minutes" integer DEFAULT 0,
    "parts_requested" integer DEFAULT 0,
    "performance_score" numeric(4,1) DEFAULT 0,
    "job_notes_count" integer DEFAULT 0,
    "overtime_alerts_count" integer DEFAULT 0,
    "generated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."migration_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "source_system" character varying NOT NULL,
    "started_at" timestamp without time zone DEFAULT "now"(),
    "completed_at" timestamp without time zone,
    "status" character varying DEFAULT 'in_progress'::character varying,
    "stats" "jsonb",
    "errors" "jsonb",
    "created_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."notification_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "event" "text" NOT NULL,
    "recipients" "uuid"[] DEFAULT '{}'::"uuid"[],
    "channels" "text"[] DEFAULT '{}'::"text"[],
    "message" "text",
    "sent_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "link" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'general'::"text",
    "priority" "text" DEFAULT 'normal'::"text",
    "is_dismissed" boolean DEFAULT false,
    "related_wo_id" "uuid",
    "related_unit" "text",
    "is_read" boolean DEFAULT false,
    CONSTRAINT "notifications_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."part_field_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "part_id" "uuid",
    "field_name" "text",
    "old_value" "text",
    "new_value" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "source" "text",
    "notes" "text"
);

CREATE TABLE IF NOT EXISTS "public"."part_installs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "part_type" "text" NOT NULL,
    "part_number" "text",
    "brand" "text",
    "description" "text",
    "position" "text",
    "install_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "install_mileage" integer DEFAULT 0,
    "install_hours" numeric(10,1) DEFAULT 0,
    "expected_life_mi" integer,
    "expected_life_days" integer,
    "cost" numeric(10,2) DEFAULT 0,
    "vendor" "text",
    "so_id" "uuid",
    "invoice_id" "uuid",
    "part_id" "uuid",
    "pm_schedule_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "replaced_date" "date",
    "replaced_mileage" integer,
    "replaced_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "part_installs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'replaced'::"text", 'failed'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."part_pricing_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "part_id" "uuid",
    "exception_name" "text",
    "exception_type" "text",
    "customer_id" "uuid",
    "value" numeric,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."part_type_configs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "part_type" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "category" "text" DEFAULT 'other'::"text",
    "default_life_mi" integer,
    "default_life_days" integer,
    "legal_minimum" "text",
    "preferred_vendor" "text",
    "preferred_brand" "text",
    "preferred_pn" "text",
    "icon" "text" DEFAULT '🔧'::"text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."part_vendor_prices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "part_type" "text" NOT NULL,
    "part_number" "text",
    "brand" "text",
    "vendor" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "quoted_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);

CREATE TABLE IF NOT EXISTS "public"."parts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "part_number" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "public"."part_category" DEFAULT 'other'::"public"."part_category",
    "on_hand" integer DEFAULT 0,
    "reserved" integer DEFAULT 0,
    "reorder_point" integer DEFAULT 2,
    "cost_price" numeric(10,2) DEFAULT 0,
    "sell_price" numeric(10,2) DEFAULT 0,
    "vendor" "text",
    "bin_location" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "core_charge" numeric(10,2) DEFAULT 0,
    "warranty_months" integer DEFAULT 0,
    "import_batch_id" "uuid",
    "external_data" "jsonb",
    "source" character varying DEFAULT 'truckzen'::character varying,
    "allocated" numeric DEFAULT 0,
    "in_transit" numeric DEFAULT 0,
    "min_qty" numeric,
    "max_qty" numeric,
    "uom" "text" DEFAULT 'each'::"text",
    "average_cost" numeric DEFAULT 0,
    "selling_price" numeric DEFAULT 0,
    "cost_floor" numeric DEFAULT 0,
    "markup_percent" numeric,
    "margin_percent" numeric,
    "inventory_balance" numeric DEFAULT 0,
    "manufacturer" "text",
    "search_tags" "text",
    "track_quantity" boolean DEFAULT true,
    "preferred_vendor" "text",
    "default_location" "text",
    "count_group" "text",
    "part_category" "text",
    "cogs_account" "text",
    "item_type" "text",
    "fee_discount" "text",
    "shop_supply_amount" "text",
    "website_link" "text",
    "upc" "text",
    "part_image" "text",
    "status" "text" DEFAULT 'active'::"text",
    "cross_references" "jsonb" DEFAULT '[]'::"jsonb",
    "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."parts_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "part_number" character varying,
    "description" "text" NOT NULL,
    "quantity" integer DEFAULT 0,
    "unit_cost" numeric(10,2) DEFAULT 0,
    "sell_price" numeric(10,2) DEFAULT 0,
    "vendor" character varying,
    "location" character varying,
    "min_stock" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."parts_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "so_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "parts_manager" "uuid",
    "description" "text" NOT NULL,
    "part_number" "text",
    "quantity" integer DEFAULT 1,
    "priority" "text" DEFAULT 'normal'::"text",
    "status" "text" DEFAULT 'requested'::"text",
    "bin_location" "text",
    "notes" "text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "ready_at" timestamp with time zone,
    "collected_at" timestamp with time zone,
    "sms_sent" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reason_returned" "text",
    "prepared_at" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "returned_at" timestamp with time zone,
    "so_line_id" "uuid",
    "approved_by_user_id" "uuid",
    "approved_at" timestamp without time zone,
    "rejected_reason" "text",
    "in_stock" boolean,
    "ordered_at" timestamp without time zone,
    "part_name" character varying,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "parts_requests_priority_check" CHECK (("priority" = ANY (ARRAY['normal'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "parts_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'preparing'::"text", 'ready'::"text", 'collected'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."payment_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "used" boolean DEFAULT false,
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "reference_number" "text",
    "stripe_payment_intent_id" "text",
    "stripe_charge_id" "text",
    "qb_payment_id" "text",
    "notes" "text",
    "received_by" "uuid",
    "payment_date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'check'::"text", 'credit_card'::"text", 'debit_card'::"text", 'ach'::"text", 'wire'::"text", 'fleet_account'::"text", 'other'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."permission_audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "target_role" "text",
    "target_user" "uuid",
    "module" "text" NOT NULL,
    "old_value" boolean,
    "new_value" boolean NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."platform_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_type" character varying NOT NULL,
    "description" "text",
    "shop_id" "uuid",
    "performed_by" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."platform_impersonation_acl" (
    "user_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "reason" "text"
);

CREATE TABLE IF NOT EXISTS "public"."platform_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "category" character varying NOT NULL,
    "provider" character varying NOT NULL,
    "monthly_cost" numeric(10,2) DEFAULT 0,
    "billing_cycle" character varying DEFAULT 'monthly'::character varying,
    "start_date" "date",
    "end_date" "date",
    "renewal_date" "date",
    "auto_renews" boolean DEFAULT true,
    "dashboard_url" character varying,
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "platform_services_billing_cycle_check" CHECK ((("billing_cycle")::"text" = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying, 'one_time'::character varying, 'usage_based'::character varying])::"text"[]))),
    CONSTRAINT "platform_services_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['hosting'::character varying, 'database'::character varying, 'email'::character varying, 'sms'::character varying, 'ai'::character varying, 'proxy'::character varying, 'domain'::character varying, 'mobile'::character varying, 'api'::character varying, 'other'::character varying])::"text"[])))
);

CREATE TABLE IF NOT EXISTS "public"."platform_usage_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "service" character varying NOT NULL,
    "usage_count" integer DEFAULT 0,
    "usage_cost" numeric(10,2) DEFAULT 0,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."pm_schedules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "service_name" "text" NOT NULL,
    "interval_type" "text" NOT NULL,
    "interval_value" integer NOT NULL,
    "last_done_at" timestamp with time zone,
    "last_done_reading" integer,
    "next_due_reading" integer,
    "next_due_date" "date",
    "estimated_cost" numeric(10,2),
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pm_schedules_interval_type_check" CHECK (("interval_type" = ANY (ARRAY['mileage'::"text", 'hours'::"text", 'calendar'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."po_lines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "po_id" "uuid" NOT NULL,
    "part_id" "uuid",
    "part_number" "text",
    "description" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "quantity_received" integer DEFAULT 0,
    "unit_cost" numeric(10,2) DEFAULT 0,
    "total_cost" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."project_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying NOT NULL,
    "category" character varying DEFAULT 'feature'::character varying,
    "status" character varying DEFAULT 'planned'::character varying,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "project_progress_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['feature'::character varying, 'integration'::character varying, 'fix'::character varying, 'database'::character varying])::"text"[]))),
    CONSTRAINT "project_progress_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['done'::character varying, 'in_progress'::character varying, 'planned'::character varying])::"text"[])))
);

CREATE TABLE IF NOT EXISTS "public"."purchase_order_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid",
    "part_id" "uuid",
    "part_number" "text",
    "description" "text",
    "quantity" numeric(10,2),
    "cost_price" numeric(10,2),
    "sell_price" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "po_number" "text" NOT NULL,
    "vendor_id" "uuid",
    "vendor_name" "text",
    "so_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text",
    "subtotal" numeric(10,2) DEFAULT 0,
    "total" numeric(10,2) DEFAULT 0,
    "expected_date" "date",
    "received_date" "date",
    "notes" "text",
    "qbo_bill_id" "text",
    "qbo_synced" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'truckzen'::"text",
    "fullbay_id" "text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "purchase_orders_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'in_transit'::"text", 'partially_received'::"text", 'received'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."repair_order_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repair_order_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "line_number" integer DEFAULT 1 NOT NULL,
    "complaint" "text" NOT NULL,
    "cause" "text",
    "correction" "text",
    "cause_original_language" "text",
    "cause_original_lang_code" "text",
    "correction_original_language" "text",
    "correction_original_lang_code" "text",
    "assigned_tech_id" "uuid",
    "authorization_status" "text" DEFAULT 'pending'::"text",
    "authorized_by" "text",
    "authorized_at" timestamp with time zone,
    "estimated_hours" numeric(6,2),
    "actual_hours" numeric(6,2) DEFAULT 0,
    "labor_rate" numeric(8,2),
    "labor_total" numeric(10,2) DEFAULT 0,
    "parts_total" numeric(10,2) DEFAULT 0,
    "line_total" numeric(10,2) DEFAULT 0,
    "status" "text" DEFAULT 'open'::"text",
    "job_template_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "repair_order_lines_authorization_status_check" CHECK (("authorization_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'authorized'::"text", 'declined'::"text", 'not_required'::"text"]))),
    CONSTRAINT "repair_order_lines_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'waiting_parts'::"text", 'waiting_authorization'::"text", 'completed'::"text", 'void'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."repair_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "ro_number" "text" NOT NULL,
    "customer_id" "uuid",
    "unit_id" "uuid",
    "service_request_id" "uuid",
    "assigned_writer_id" "uuid",
    "assigned_tech_id" "uuid",
    "team_id" "uuid",
    "bay_number" "text",
    "status" "text" DEFAULT 'open'::"text",
    "priority" "text" DEFAULT 'normal'::"text",
    "check_in_type" "text" DEFAULT 'service_writer'::"text",
    "customer_complaint" "text",
    "promised_date" timestamp with time zone,
    "labor_total" numeric(10,2) DEFAULT 0,
    "parts_total" numeric(10,2) DEFAULT 0,
    "subtotal" numeric(10,2) DEFAULT 0,
    "tax_amount" numeric(10,2) DEFAULT 0,
    "total" numeric(10,2) DEFAULT 0,
    "internal_notes" "text",
    "customer_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    CONSTRAINT "repair_orders_check_in_type_check" CHECK (("check_in_type" = ANY (ARRAY['kiosk'::"text", 'qr_code'::"text", 'service_writer'::"text", 'phone'::"text", 'fleet_request'::"text"]))),
    CONSTRAINT "repair_orders_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "repair_orders_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'waiting_parts'::"text", 'waiting_authorization'::"text", 'authorized'::"text", 'completed'::"text", 'invoiced'::"text", 'closed'::"text", 'void'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."ro_line_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "repair_order_id" "uuid" NOT NULL,
    "repair_order_line_id" "uuid" NOT NULL,
    "part_id" "uuid",
    "part_number" "text" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(8,2) DEFAULT 1 NOT NULL,
    "unit_cost" numeric(10,2) DEFAULT 0 NOT NULL,
    "unit_sell" numeric(10,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'assigned'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ro_line_parts_status_check" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'ordered'::"text", 'received'::"text", 'installed'::"text", 'returned'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."ro_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "repair_order_id" "uuid" NOT NULL,
    "repair_order_line_id" "uuid",
    "uploaded_by" "uuid",
    "storage_path" "text" NOT NULL,
    "file_name" "text",
    "file_size" integer,
    "mime_type" "text",
    "photo_type" "text" DEFAULT 'damage'::"text",
    "caption" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ro_photos_photo_type_check" CHECK (("photo_type" = ANY (ARRAY['damage'::"text", 'before'::"text", 'after'::"text", 'diagnostic'::"text", 'other'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "module" "text" NOT NULL,
    "allowed" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."service_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "so_number" "text" NOT NULL,
    "status" "public"."so_status" DEFAULT 'draft'::"public"."so_status",
    "source" "public"."so_source" DEFAULT 'walk_in'::"public"."so_source",
    "priority" "public"."so_priority" DEFAULT 'normal'::"public"."so_priority",
    "asset_id" "uuid",
    "customer_id" "uuid",
    "odometer_in" integer,
    "odometer_out" integer,
    "team" "text",
    "bay" "text",
    "assigned_tech" "uuid",
    "advisor_id" "uuid",
    "complaint" "text",
    "cause" "text",
    "correction" "text",
    "internal_notes" "text",
    "promised_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "labor_total" numeric(10,2) DEFAULT 0,
    "parts_total" numeric(10,2) DEFAULT 0,
    "tax_total" numeric(10,2) DEFAULT 0,
    "grand_total" numeric(10,2) DEFAULT 0,
    "telegram_msg_id" bigint,
    "mechanic_status" "text" DEFAULT 'not_accepted'::"text",
    "progress_pct" integer DEFAULT 0,
    "time_started" timestamp with time zone,
    "time_paused" timestamp with time zone,
    "total_minutes_worked" integer DEFAULT 0,
    "service_writer_id" "uuid",
    "parts_person_id" "uuid",
    "customer_contact_name" "text",
    "customer_contact_phone" "text",
    "fleet_contact_name" "text",
    "fleet_contact_phone" "text",
    "po_number" "text",
    "estimate_date" timestamp with time zone,
    "created_by_user_id" "uuid",
    "portal_token" "uuid" DEFAULT "gen_random_uuid"(),
    "auth_type" character varying,
    "auth_limit" numeric(10,2),
    "approved_at" timestamp with time zone,
    "approved_by" character varying,
    "wo_status" character varying DEFAULT 'open'::character varying,
    "mileage_at_checkin" integer,
    "signature_data" "text",
    "estimate_status" character varying DEFAULT 'pending'::character varying,
    "estimate_approved_date" timestamp with time zone,
    "estimate_declined_reason" "text",
    "estimate_created_date" timestamp with time zone,
    "is_historical" boolean DEFAULT false,
    "original_so_number" character varying,
    "deleted_at" timestamp without time zone,
    "is_test_data" boolean DEFAULT false,
    "invoice_status" character varying DEFAULT 'draft'::character varying,
    "quality_check_errors" "jsonb",
    "accounting_notes" "text",
    "accounting_approved_by" "uuid",
    "accounting_approved_at" timestamp with time zone,
    "fullbay_id" character varying,
    "fullbay_synced_at" timestamp with time zone,
    "external_data" "jsonb",
    "warranty_checked" boolean DEFAULT false,
    "warranty_status" character varying DEFAULT 'not_checked'::character varying,
    "warranty_notes" "text",
    "warranty_checked_by" "uuid",
    "warranty_checked_at" timestamp with time zone,
    "approval_status" "text" DEFAULT 'pre_approved'::"text",
    "approval_type" "text" DEFAULT 'company'::"text",
    "warranty_vendor" "text",
    "warranty_expiry" "date",
    "approval_token" "uuid" DEFAULT "gen_random_uuid"(),
    "warranty_dealer_name" "text",
    "warranty_dealer_location" "text",
    "warranty_dealer_appointment" timestamp with time zone,
    "warranty_resolved_by" "uuid",
    "warranty_resolved_at" timestamp with time zone,
    "labor_subtotal" numeric(10,2) DEFAULT 0,
    "parts_subtotal" numeric(10,2) DEFAULT 0,
    "sublet_total" numeric(10,2) DEFAULT 0,
    "discount_total" numeric(10,2) DEFAULT 0,
    "payment_date" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "quality_checked_by" "uuid",
    "quality_checked_at" timestamp with time zone,
    "mileage_at_service" integer,
    "dealer_outcome" "text",
    "estimate_id" "uuid",
    "estimate_approved" boolean DEFAULT false,
    "ownership_type" character varying DEFAULT 'fleet_asset'::character varying,
    "estimate_required" boolean DEFAULT false,
    "job_type" "text" DEFAULT 'repair'::"text",
    "submitted_at" timestamp with time zone,
    "estimate_type" "text",
    "estimate_sent_at" timestamp with time zone,
    "estimate_approved_at" timestamp with time zone,
    "parts_completed_at" timestamp with time zone,
    "assigned_at" timestamp with time zone,
    "repair_started_at" timestamp with time zone,
    "repair_completed_at" timestamp with time zone,
    "invoiced_at" timestamp with time zone,
    "workorder_lane" "text" DEFAULT 'shop_internal'::"text",
    "status_family" "text",
    "lane_status" "text",
    "financial_owner_domain" "text",
    "billing_relationship" "text",
    "repair_location_type" "text",
    "origin_service_request_id" "uuid",
    "approval_method" "text",
    CONSTRAINT "chk_billing_relationship" CHECK ((("billing_relationship" IS NULL) OR ("billing_relationship" = ANY (ARRAY['external_customer'::"text", 'internal_company_repair'::"text", 'outside_vendor_repair'::"text", 'warranty'::"text", 'owner_operator'::"text"])))),
    CONSTRAINT "chk_financial_owner_domain" CHECK ((("financial_owner_domain" IS NULL) OR ("financial_owner_domain" = ANY (ARRAY['shop_accounting'::"text", 'fleet_accounting'::"text"])))),
    CONSTRAINT "chk_repair_location_type" CHECK ((("repair_location_type" IS NULL) OR ("repair_location_type" = ANY (ARRAY['ugl_shop'::"text", 'connected_shop'::"text", 'external_vendor'::"text", 'roadside'::"text", 'yard'::"text"])))),
    CONSTRAINT "chk_status_family" CHECK ((("status_family" IS NULL) OR ("status_family" = ANY (ARRAY['draft'::"text", 'open'::"text", 'waiting'::"text", 'active'::"text", 'done'::"text", 'closed'::"text", 'void'::"text"])))),
    CONSTRAINT "chk_workorder_lane" CHECK ((("workorder_lane" IS NULL) OR ("workorder_lane" = ANY (ARRAY['shop_internal'::"text", 'maintenance_external'::"text"])))),
    CONSTRAINT "service_orders_mechanic_status_check" CHECK (("mechanic_status" = ANY (ARRAY['not_accepted'::"text", 'accepted'::"text", 'in_progress'::"text", 'paused'::"text", 'completed'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."service_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "asset_id" "uuid",
    "unit_number" "text",
    "company_name" "text",
    "contact_name" "text",
    "phone" "text",
    "description" "text" NOT NULL,
    "source" "text" DEFAULT 'kiosk_checkin'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "reject_reason" "text",
    "scheduled_date" "date",
    "converted_so_id" "uuid",
    "kiosk_checkin_id" "uuid",
    "created_by" "text" DEFAULT 'kiosk'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unit_id" "uuid",
    "check_in_type" "text" DEFAULT 'kiosk'::"text",
    "converted_to_ro_id" "uuid",
    "requested_by_role" character varying,
    "requested_by_name" character varying,
    "original_request" "text",
    "expected_arrival" timestamp with time zone,
    "parking_location" "text",
    "key_location" "text",
    "promised_date" timestamp with time zone,
    "urgency" "text" DEFAULT 'normal'::"text",
    "request_lane" "text",
    "requesting_department" "text",
    "target_shop_id" "uuid",
    "target_department" "text",
    "request_type" "text",
    "converted_workorder_id" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "service_requests_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'scheduled'::"text", 'converted'::"text", 'rejected'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."shop_labor_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "ownership_type" "text" NOT NULL,
    "rate_per_hour" numeric(10,2) DEFAULT 0 NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parts_margin_pct" numeric(5,2) DEFAULT 0,
    "parts_markup_pct" numeric(5,2) DEFAULT 0,
    "parts_pricing_mode" "text" DEFAULT 'markup'::"text",
    CONSTRAINT "shop_labor_rates_ownership_type_check" CHECK (("ownership_type" = ANY (ARRAY['fleet_asset'::"text", 'owner_operator'::"text", 'outside_customer'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."shop_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_name" character varying NOT NULL,
    "owner_name" character varying NOT NULL,
    "owner_email" character varying NOT NULL,
    "owner_phone" character varying,
    "address" character varying,
    "city" character varying,
    "state" character varying,
    "zip" character varying,
    "fleet_size" integer,
    "current_software" character varying,
    "message" "text",
    "status" character varying DEFAULT 'pending'::character varying,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "reject_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shop_registrations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);

CREATE TABLE IF NOT EXISTS "public"."shop_sequences" (
    "shop_id" "uuid" NOT NULL,
    "next_ro_number" integer DEFAULT 1001,
    "next_estimate_number" integer DEFAULT 1001,
    "next_invoice_number" integer DEFAULT 1001,
    "ro_prefix" "text" DEFAULT 'RO'::"text",
    "estimate_prefix" "text" DEFAULT 'EST'::"text",
    "invoice_prefix" "text" DEFAULT 'INV'::"text"
);

CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "dba" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "timezone" "text" DEFAULT 'America/Chicago'::"text",
    "labor_rate" numeric(8,2) DEFAULT 145.00,
    "tax_rate" numeric(5,2) DEFAULT 0.0825,
    "dot_number" "text",
    "mc_number" "text",
    "setup_complete" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "stripe_account_id" "text",
    "qbo_access_token" "text",
    "qbo_refresh_token" "text",
    "qbo_token_expiry" timestamp with time zone,
    "qbo_realm_id" "text",
    "qbo_connected" boolean DEFAULT false,
    "stripe_customer_id" "text",
    "subscription_status" "text" DEFAULT 'free'::"text",
    "subscription_plan" "text" DEFAULT 'free'::"text",
    "share_token" "text",
    "county" character varying,
    "tax_labor" boolean DEFAULT false,
    "default_labor_rate" numeric(10,2) DEFAULT 105.00,
    "kiosk_code" character varying,
    "kiosk_enabled" boolean DEFAULT true,
    "kiosk_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "retention_policy" "jsonb" DEFAULT '{"completed_wo_years": null, "closed_invoices_years": null, "inactive_customers_years": 7}'::"jsonb",
    "logo_url" "text",
    "brand_color" character varying DEFAULT '#1B6EE6'::character varying,
    "website" character varying,
    "invoice_footer" "text",
    "email_footer" "text",
    "status" character varying DEFAULT 'active'::character varying,
    "created_by" "uuid",
    "trial_ends_at" timestamp without time zone,
    "kiosk_pin" character varying DEFAULT '0000'::character varying,
    "maintenance_coordinator_phone" character varying,
    "monthly_revenue" numeric(10,2) DEFAULT 0,
    "onboarded_at" timestamp with time zone,
    "onboarded_by" "uuid",
    "notes" "text",
    "ai_monthly_limit" integer DEFAULT 500,
    "ai_alert_threshold" integer DEFAULT 400,
    "ai_usage_enabled" boolean DEFAULT true,
    "default_tax_rate" numeric(5,2) DEFAULT 0,
    "geofence_lat" double precision,
    "geofence_lng" double precision,
    "geofence_radius_meters" integer DEFAULT 100,
    "payment_payee_name" "text",
    "payment_bank_name" "text",
    "payment_ach_account" "text",
    "payment_ach_routing" "text",
    "payment_wire_account" "text",
    "payment_wire_routing" "text",
    "payment_zelle_email_1" "text",
    "payment_zelle_email_2" "text",
    "payment_mail_payee" "text",
    "payment_mail_address" "text",
    "payment_mail_address_2" "text",
    "payment_mail_city" "text",
    "payment_mail_state" "text",
    "payment_mail_zip" "text",
    "payment_note" "text"
);

CREATE TABLE IF NOT EXISTS "public"."so_lines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "so_id" "uuid" NOT NULL,
    "line_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "part_number" "text",
    "quantity" numeric(8,2) DEFAULT 1,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) GENERATED ALWAYS AS (("quantity" * "unit_price")) STORED,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "assigned_to" "uuid",
    "team_id" "uuid",
    "finding" "text",
    "resolution" "text",
    "estimated_hours" numeric(6,2) DEFAULT 0,
    "actual_hours" numeric(6,2) DEFAULT 0,
    "billed_hours" numeric(6,2) DEFAULT 0,
    "line_status" character varying DEFAULT 'unassigned'::character varying,
    "customer_approved" boolean,
    "approved_at" timestamp with time zone,
    "is_additional" boolean DEFAULT false,
    "required_skills" "text"[] DEFAULT '{}'::"text"[],
    "labor_rate" numeric(10,2),
    "labor_minutes" integer DEFAULT 0,
    "labor_cost" numeric(10,2) DEFAULT 0,
    "external_data" "jsonb",
    "approval_status" character varying DEFAULT 'pre_approved'::character varying,
    "approval_required" boolean DEFAULT false,
    "approved_by" "uuid",
    "approval_notes" "text",
    "rough_parts" "jsonb",
    "customer_provides_parts" boolean DEFAULT false,
    "rough_name" "text",
    "real_name" "text",
    "parts_status" "text" DEFAULT 'rough'::"text",
    "job_group_id" "uuid",
    "job_group_name" "text",
    "labor_hours" numeric(10,2),
    "parts_sell_price" numeric(10,2),
    "parts_cost_price" numeric(10,2),
    "parts_quantity" integer DEFAULT 1,
    "misc_charge" numeric(10,2) DEFAULT 0,
    "misc_description" "text",
    "discount_amount" numeric(10,2) DEFAULT 0,
    "tax_rate" numeric(5,2) DEFAULT 0,
    "line_total" numeric(10,2),
    "tire_position" "text",
    "parts_added_at" timestamp with time zone,
    "parts_ready_at" timestamp with time zone,
    "assigned_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "estimate_approved_at" timestamp with time zone,
    "estimate_needed" boolean DEFAULT false,
    "related_labor_line_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "supplement_batch_id" "uuid",
    "emergency_override_by" "uuid",
    "emergency_override_reason" "text",
    "emergency_override_at" timestamp with time zone,
    "parts_requirement" "text",
    "parts_requirement_note" "text",
    CONSTRAINT "so_lines_line_type_check" CHECK (("line_type" = ANY (ARRAY['labor'::"text", 'part'::"text", 'sublet'::"text", 'fee'::"text"]))),
    CONSTRAINT "so_lines_parts_requirement_chk" CHECK ((("parts_requirement" IS NULL) OR ("parts_requirement" = ANY (ARRAY['needed'::"text", 'customer_supplied'::"text", 'not_needed'::"text", 'override'::"text"]))))
);

CREATE TABLE IF NOT EXISTS "public"."so_time_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "so_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clocked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clocked_out_at" timestamp with time zone,
    "duration_minutes" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "so_line_id" "uuid",
    "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."telegram_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "telegram_id" bigint NOT NULL,
    "user_id" "uuid",
    "message_text" "text" NOT NULL,
    "action_taken" "text",
    "action_data" "jsonb",
    "success" boolean DEFAULT true,
    "error_msg" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "repair_order_id" "uuid" NOT NULL,
    "repair_order_line_id" "uuid" NOT NULL,
    "tech_id" "uuid" NOT NULL,
    "clock_in" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clock_out" timestamp with time zone,
    "hours_worked" numeric(6,2),
    "entry_type" "text" DEFAULT 'labor'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "time_entries_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['labor'::"text", 'diagnostic'::"text", 'rework'::"text", 'warranty'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."tire_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "wo_id" "uuid",
    "so_line_id" "uuid",
    "position" "text" NOT NULL,
    "action" "text" NOT NULL,
    "tire_brand" "text",
    "tire_size" "text",
    "tire_model" "text",
    "tread_depth_before" numeric(4,1),
    "tread_depth_after" numeric(4,1),
    "mileage_at_service" integer,
    "notes" "text",
    "performed_at" timestamp with time zone DEFAULT "now"(),
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tire_history_action_check" CHECK (("action" = ANY (ARRAY['replaced'::"text", 'repaired'::"text", 'rotated'::"text", 'inspected'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."tire_pressure_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tire_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "psi" numeric(5,1) NOT NULL,
    "target_psi" numeric(5,1) DEFAULT 100,
    "logged_by" "uuid",
    "dvir_id" "uuid",
    "logged_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."tire_rotations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "rotated_at" timestamp with time zone DEFAULT "now"(),
    "mileage" integer,
    "rotated_by" "uuid",
    "moves" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text"
);

CREATE TABLE IF NOT EXISTS "public"."tire_tread_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tire_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "tread_depth" numeric(4,1) NOT NULL,
    "mileage" integer,
    "measured_by" "uuid",
    "measured_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."tire_vendor_prices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "vendor" "text" NOT NULL,
    "brand" "text" NOT NULL,
    "model" "text",
    "size" "text" NOT NULL,
    "is_recap" boolean DEFAULT false,
    "price" numeric(10,2) NOT NULL,
    "quoted_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);

CREATE TABLE IF NOT EXISTS "public"."tires" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "position" "text" NOT NULL,
    "brand" "text",
    "model" "text",
    "size" "text",
    "dot_code" "text",
    "is_recap" boolean DEFAULT false,
    "recap_vendor" "text",
    "install_date" "date",
    "install_mileage" integer DEFAULT 0,
    "expected_life" integer DEFAULT 100000,
    "current_tread" numeric(4,1),
    "legal_min_tread" numeric(4,1) DEFAULT 2.0,
    "cost" numeric(10,2) DEFAULT 0,
    "vendor" "text",
    "status" "text" DEFAULT 'active'::"text",
    "removed_date" "date",
    "removed_mileage" integer,
    "removal_reason" "text",
    "failure_notes" "text",
    "failure_photos" "text"[] DEFAULT '{}'::"text"[],
    "qr_token" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tires_position_check" CHECK (("position" = ANY (ARRAY['steer_left'::"text", 'steer_right'::"text", 'drive_outer_left'::"text", 'drive_inner_left'::"text", 'drive_inner_right'::"text", 'drive_outer_right'::"text", 'trailer_outer_left'::"text", 'trailer_inner_left'::"text", 'trailer_inner_right'::"text", 'trailer_outer_right'::"text", 'spare'::"text"]))),
    CONSTRAINT "tires_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'removed'::"text", 'failed'::"text", 'scrapped'::"text", 'retreaded'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "language" character varying NOT NULL,
    "key" character varying NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "unit_number" "text",
    "vin" "text",
    "license_plate" "text",
    "dot_number" "text",
    "year" integer,
    "make" "text",
    "model" "text",
    "unit_type" "text" DEFAULT 'truck'::"text",
    "engine_make" "text",
    "engine_model" "text",
    "current_mileage" integer,
    "current_engine_hours" integer,
    "last_mileage_update" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ownership_type" "text" DEFAULT 'fleet_asset'::"text",
    CONSTRAINT "units_ownership_type_check" CHECK (("ownership_type" = ANY (ARRAY['fleet_asset'::"text", 'owner_operator'::"text", 'outside_customer'::"text"]))),
    CONSTRAINT "units_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'sold'::"text", 'scrapped'::"text"]))),
    CONSTRAINT "units_unit_type_check" CHECK (("unit_type" = ANY (ARRAY['truck'::"text", 'trailer'::"text", 'reefer'::"text", 'other'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."user_permission_overrides" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "module" "text" NOT NULL,
    "allowed" boolean NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "account_number" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "lead_days" integer DEFAULT 2,
    "payment_terms" "text" DEFAULT 'Net 30'::"text",
    "vendor_type" "text" DEFAULT 'National'::"text",
    "notes" "text",
    "active" boolean DEFAULT true,
    "qbo_vendor_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fullbay_name" "text",
    "source" "text" DEFAULT 'truckzen'::"text"
);

CREATE TABLE IF NOT EXISTS "public"."wo_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wo_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "details" "jsonb"
);

CREATE TABLE IF NOT EXISTS "public"."wo_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wo_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "file_url" "text" NOT NULL,
    "filename" "text",
    "caption" "text",
    "visible_to_customer" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."wo_job_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "line_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "percentage" integer DEFAULT 100,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."wo_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wo_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "note_text" "text" NOT NULL,
    "visible_to_customer" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."wo_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wo_id" "uuid" NOT NULL,
    "line_id" "uuid" NOT NULL,
    "part_number" character varying,
    "description" "text" NOT NULL,
    "quantity" integer DEFAULT 1,
    "unit_cost" numeric(10,2) DEFAULT 0,
    "status" character varying DEFAULT 'needed'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_additional" boolean DEFAULT false,
    "customer_approved" boolean,
    "approved_at" timestamp with time zone,
    "supplement_batch_id" "uuid",
    "emergency_override_by" "uuid",
    "emergency_override_reason" "text",
    "emergency_override_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."wo_shop_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wo_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(10,2) DEFAULT 0,
    "taxable" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."work_punches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "punch_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "punch_out_at" timestamp with time zone,
    "duration_minutes" integer,
    "geo_lat" double precision,
    "geo_lng" double precision,
    "geo_accuracy" double precision,
    "inside_geofence" boolean DEFAULT true,
    "override_flag" boolean DEFAULT false,
    "override_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_event_id" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."worker_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "department" "text",
    "workflow_lane" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "capabilities" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_wp_workflow_lane" CHECK ((("workflow_lane" IS NULL) OR ("workflow_lane" = ANY (ARRAY['shop_internal'::"text", 'maintenance_external'::"text", 'multi_lane'::"text"]))))
);


-- ==== alter sequence ====
ALTER SEQUENCE "public"."so_number_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."wo_number_seq" OWNER TO "postgres";


-- ==== functions ====
CREATE OR REPLACE FUNCTION "public"."advance_pm_schedule"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.pm_schedule_id IS NOT NULL THEN
    UPDATE pm_schedules SET
      last_service_date    = COALESCE(NEW.completed_date, CURRENT_DATE),
      last_service_reading = NEW.odometer_at_service,
      next_due_date = CASE
        WHEN interval_days IS NOT NULL THEN COALESCE(NEW.completed_date, CURRENT_DATE) + interval_days
        ELSE next_due_date
      END,
      next_due_reading = CASE
        WHEN interval_miles IS NOT NULL AND NEW.odometer_at_service IS NOT NULL
        THEN NEW.odometer_at_service + interval_miles
        ELSE next_due_reading
      END
    WHERE id = NEW.pm_schedule_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."audit_trigger_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  changed TEXT[] := '{}';
  k TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT key FROM jsonb_each(to_jsonb(NEW)) LOOP
      IF to_jsonb(OLD) -> k IS DISTINCT FROM to_jsonb(NEW) -> k THEN
        changed := array_append(changed, k);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO audit_log (
    shop_id, action, table_name, record_id,
    old_data, new_data, changed_fields, created_at
  ) VALUES (
    CASE WHEN TG_OP = 'DELETE' THEN OLD.shop_id ELSE NEW.shop_id END,
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    changed,
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."auto_block_on_failed_logins"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  fail_count INT;
BEGIN
  IF NOT NEW.success THEN
    SELECT COUNT(*) INTO fail_count
    FROM login_attempts
    WHERE ip_address = NEW.ip_address
    AND success = false
    AND created_at > NOW() - INTERVAL '5 minutes';

    IF fail_count >= 10 THEN
      INSERT INTO blocked_ips (ip_address, reason, expires_at)
      VALUES (
        NEW.ip_address,
        'Auto-blocked: 10+ failed logins in 5 minutes',
        NOW() + INTERVAL '1 hour'
      )
      ON CONFLICT (ip_address) DO UPDATE
        SET expires_at = NOW() + INTERVAL '1 hour',
            reason = 'Auto-blocked: repeated failed logins';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."check_invoice_duplicates"("p_invoice_id" "uuid") RETURNS TABLE("issue_type" "text", "description" "text", "severity" "text", "line_ids" "uuid"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  -- Check for duplicate part numbers
  RETURN QUERY
  SELECT
    'DUPLICATE_PART'::TEXT,
    'Part "' || MIN(l.description) || '" (PN: ' || l.part_number || ') appears ' ||
      COUNT(*)::TEXT || ' times'::TEXT,
    'WARNING'::TEXT,
    ARRAY_AGG(l.id)
  FROM so_lines l
  JOIN invoices i ON i.so_id = l.so_id
  WHERE i.id = p_invoice_id
  AND l.line_type = 'part'
  AND l.part_number IS NOT NULL
  GROUP BY l.part_number
  HAVING COUNT(*) > 1;

  -- Check for duplicate descriptions
  RETURN QUERY
  SELECT
    'DUPLICATE_DESCRIPTION'::TEXT,
    'Line "' || LOWER(MIN(l.description)) || '" appears ' ||
      COUNT(*)::TEXT || ' times'::TEXT,
    'WARNING'::TEXT,
    ARRAY_AGG(l.id)
  FROM so_lines l
  JOIN invoices i ON i.so_id = l.so_id
  WHERE i.id = p_invoice_id
  AND l.line_type = 'part'
  GROUP BY LOWER(l.description)
  HAVING COUNT(*) > 1;

  -- Check for missing technician
  RETURN QUERY
  SELECT
    'NO_TECHNICIAN'::TEXT,
    'No technician assigned to service order'::TEXT,
    'ERROR'::TEXT,
    ARRAY[]::UUID[]
  FROM invoices i
  JOIN service_orders so ON so.id = i.so_id
  WHERE i.id = p_invoice_id
  AND so.assigned_tech IS NULL;

  -- Check for service order not done
  RETURN QUERY
  SELECT
    'JOB_NOT_COMPLETE'::TEXT,
    'Service order status is "' || so.status::TEXT || '" — not ready to invoice'::TEXT,
    'ERROR'::TEXT,
    ARRAY[]::UUID[]
  FROM invoices i
  JOIN service_orders so ON so.id = i.so_id
  WHERE i.id = p_invoice_id
  AND so.status NOT IN ('done','good_to_go','ready_final_inspection');

  -- Check for zero-price lines
  RETURN QUERY
  SELECT
    'ZERO_PRICE'::TEXT,
    'Line "' || l.description || '" has $0 price'::TEXT,
    'WARNING'::TEXT,
    ARRAY[l.id]
  FROM so_lines l
  JOIN invoices i ON i.so_id = l.so_id
  WHERE i.id = p_invoice_id
  AND (l.unit_price IS NULL OR l.unit_price = 0);
END;
$_$;

CREATE OR REPLACE FUNCTION "public"."cleanup_expired_payment_tokens"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM payment_tokens
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$;

CREATE OR REPLACE FUNCTION "public"."compute_time_entry_duration"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.clocked_out_at IS NOT NULL AND OLD.clocked_out_at IS NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.clocked_out_at - NEW.clocked_in_at)) / 60;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."current_shop_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT shop_id FROM users WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM users WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION "public"."current_user_team"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT team FROM users WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION "public"."find_mechanics_by_skills"("shop" "uuid", "needed_skills" "text"[]) RETURNS SETOF "public"."users"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT * FROM users
  WHERE shop_id = shop
  AND role IN ('technician', 'lead_tech')
  AND active = true
  AND skills && needed_skills
  ORDER BY
    CASE WHEN role = 'lead_tech' THEN 0 ELSE 1 END,
    CASE WHEN availability = 'available' THEN 0 WHEN availability = 'busy' THEN 1 WHEN availability = 'break' THEN 2 ELSE 3 END;
$$;

CREATE OR REPLACE FUNCTION "public"."generate_so_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(so_number FROM 4) AS INT)), 0) + 1
  INTO next_num
  FROM service_orders
  WHERE shop_id = p_shop_id;
  RETURN 'SO-' || LPAD(next_num::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_next_estimate_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_number INTEGER;
  v_prefix TEXT;
BEGIN
  INSERT INTO shop_sequences (shop_id) VALUES (p_shop_id) ON CONFLICT DO NOTHING;
  UPDATE shop_sequences SET next_estimate_number = next_estimate_number + 1
  WHERE shop_id = p_shop_id
  RETURNING next_estimate_number - 1, estimate_prefix INTO v_number, v_prefix;
  RETURN v_prefix || '-' || LPAD(v_number::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_next_invoice_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_number INTEGER;
  v_prefix TEXT;
BEGIN
  INSERT INTO shop_sequences (shop_id) VALUES (p_shop_id) ON CONFLICT DO NOTHING;
  UPDATE shop_sequences SET next_invoice_number = next_invoice_number + 1
  WHERE shop_id = p_shop_id
  RETURNING next_invoice_number - 1, invoice_prefix INTO v_number, v_prefix;
  RETURN v_prefix || '-' || LPAD(v_number::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_next_ro_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_number INTEGER;
  v_prefix TEXT;
BEGIN
  INSERT INTO shop_sequences (shop_id) VALUES (p_shop_id) ON CONFLICT DO NOTHING;
  UPDATE shop_sequences
  SET next_ro_number = next_ro_number + 1
  WHERE shop_id = p_shop_id
  RETURNING next_ro_number - 1, ro_prefix INTO v_number, v_prefix;
  RETURN v_prefix || '-' || LPAD(v_number::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_shop_stats"("p_shop_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'open_jobs',        (SELECT COUNT(*) FROM service_orders WHERE shop_id = p_shop_id AND status NOT IN ('good_to_go','void')),
    'in_progress',      (SELECT COUNT(*) FROM service_orders WHERE shop_id = p_shop_id AND status = 'in_progress'),
    'waiting_parts',    (SELECT COUNT(*) FROM service_orders WHERE shop_id = p_shop_id AND status = 'waiting_parts'),
    'good_to_go',       (SELECT COUNT(*) FROM service_orders WHERE shop_id = p_shop_id AND status = 'good_to_go'),
    'low_stock_parts',  (SELECT COUNT(*) FROM parts WHERE shop_id = p_shop_id AND on_hand <= reorder_point),
    'overdue_invoices', (SELECT COUNT(*) FROM invoices WHERE shop_id = p_shop_id AND status = 'sent' AND due_date < CURRENT_DATE),
    'overdue_pm',       (SELECT COUNT(*) FROM pm_schedules WHERE shop_id = p_shop_id AND active = true AND next_due_date < CURRENT_DATE),
    'revenue_mtd',      (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE shop_id = p_shop_id AND status = 'paid' AND DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', NOW()))
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_user_shop_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT shop_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION "public"."is_ip_blocked"("check_ip" "inet") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_ips
    WHERE ip_address = check_ip
    AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

CREATE OR REPLACE FUNCTION "public"."is_unlimited"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role IN ('owner','gm','it_person')
  FROM users WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION "public"."next_invoice_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
  v_year  TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM invoices WHERE shop_id = p_shop_id;
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  RETURN 'INV-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."next_issue_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE v_count INT; v_year TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM maint_issues WHERE shop_id = p_shop_id;
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  RETURN 'ISS-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."next_po_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INT;
  v_year TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM maint_purchase_orders WHERE shop_id = p_shop_id;
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  RETURN 'PO-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."next_repair_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INT;
  v_year TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM maint_road_repairs WHERE shop_id = p_shop_id;
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  RETURN 'RR-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."next_so_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
  v_year  TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM service_orders WHERE shop_id = p_shop_id;
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  RETURN 'SO-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION "public"."next_wo_number"("p_shop_id" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
      RETURN 'WO-' || nextval('wo_number_seq')::TEXT;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."next_wo_number_debug"("p_shop_id" "uuid") RETURNS TABLE("max_wo" bigint, "max_plain" bigint, "next_num" bigint, "result" "text")
    LANGUAGE "plpgsql"
    AS $_$
      DECLARE
        v_max_wo BIGINT := 0;
        v_max_plain BIGINT := 0;
        v_next BIGINT;
      BEGIN
        SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(so_number, '^WO-[0-9]+-', '') AS BIGINT)), 0)
        INTO v_max_wo
        FROM service_orders
        WHERE shop_id = p_shop_id AND so_number ~ '^WO-[0-9]+-[0-9]+$';

        SELECT COALESCE(MAX(CAST(so_number AS BIGINT)), 0)
        INTO v_max_plain
        FROM service_orders
        WHERE shop_id = p_shop_id AND so_number ~ '^[0-9]+$';

        v_next := GREATEST(v_max_wo, v_max_plain) + 1;
        RETURN QUERY SELECT v_max_wo, v_max_plain, v_next, 
          'WO-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(v_next::TEXT, 5, '0');
      END;
      $_$;

CREATE OR REPLACE FUNCTION "public"."prevent_bulk_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Allow deletes only if the session variable is explicitly set
  IF current_setting('app.allow_bulk_delete', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Bulk delete not allowed. Set app.allow_bulk_delete=true to proceed.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."prevent_lane_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
      IF OLD.workorder_lane IS NOT NULL AND NEW.workorder_lane IS DISTINCT FROM OLD.workorder_lane THEN
        RAISE EXCEPTION 'workorder_lane is immutable once set';
      END IF;
      RETURN NEW;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."purge_old_deleted_records"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM service_orders WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM customers WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM assets WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM parts WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM service_requests WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM estimates WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM invoices WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM purchase_orders WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM parts_requests WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM so_time_entries WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
  DELETE FROM kiosk_checkins WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '45 days';
END;
$$;

CREATE OR REPLACE FUNCTION "public"."recalculate_so_total"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    DECLARE
      v_historical BOOLEAN;
    BEGIN
      SELECT is_historical INTO v_historical
      FROM service_orders
      WHERE id = COALESCE(NEW.so_id, OLD.so_id);

      IF v_historical = true THEN
        RETURN COALESCE(NEW, OLD);
      END IF;

      UPDATE service_orders
      SET grand_total = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM so_lines
        WHERE so_id = COALESCE(NEW.so_id, OLD.so_id)
      )
      WHERE id = COALESCE(NEW.so_id, OLD.so_id);
      RETURN COALESCE(NEW, OLD);
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."recalculate_so_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    DECLARE
      v_historical BOOLEAN;
      v_tax_rate NUMERIC;
      v_labor NUMERIC;
      v_parts NUMERIC;
      v_tax NUMERIC;
    BEGIN
      SELECT is_historical INTO v_historical
      FROM service_orders
      WHERE id = COALESCE(NEW.so_id, OLD.so_id);

      IF v_historical = true THEN
        RETURN NEW;
      END IF;

      SELECT s.tax_rate INTO v_tax_rate
      FROM service_orders so
      JOIN shops s ON s.id = so.shop_id
      WHERE so.id = COALESCE(NEW.so_id, OLD.so_id);

      SELECT
        COALESCE(SUM(CASE WHEN line_type='labor' THEN total_price ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN line_type='part'  THEN total_price ELSE 0 END), 0)
      INTO v_labor, v_parts
      FROM so_lines
      WHERE so_id = COALESCE(NEW.so_id, OLD.so_id);

      v_tax := (v_labor + v_parts) * COALESCE(v_tax_rate, 0.0825);

      UPDATE service_orders SET
        labor_total = v_labor,
        parts_total = v_parts,
        tax_total   = v_tax,
        grand_total = v_labor + v_parts + v_tax
      WHERE id = COALESCE(NEW.so_id, OLD.so_id);

      RETURN NEW;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."seed_platform_owner_impersonation_acl"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Promotion / new platform owner: seed ACL rows for every shop.
  IF NEW.is_platform_owner IS TRUE THEN
    IF TG_OP = 'INSERT' OR COALESCE(OLD.is_platform_owner, false) = false THEN
      INSERT INTO platform_impersonation_acl (user_id, shop_id, granted_by, reason)
      SELECT NEW.id, s.id, NEW.id, 'auto-seed:new-platform-owner'
      FROM shops s
      ON CONFLICT (user_id, shop_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  -- Demotion (true -> false): revoke active ACL rows for this user.
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_platform_owner, false) = true THEN
    UPDATE platform_impersonation_acl
    SET revoked_at = now()
    WHERE user_id = NEW.id AND revoked_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."set_status_family"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- On INSERT: set status_family if NULL
  -- On UPDATE: re-map status_family when status actually changes
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_family IS NULL AND NEW.status IS NOT NULL THEN
      NEW.status_family := CASE NEW.status::text
        WHEN 'draft' THEN 'draft'
        WHEN 'waiting_approval' THEN 'waiting'
        WHEN 'in_progress' THEN 'active'
        WHEN 'done' THEN 'done'
        WHEN 'void' THEN 'void'
        ELSE 'draft'
      END;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status_family := CASE NEW.status::text
        WHEN 'draft' THEN 'draft'
        WHEN 'waiting_approval' THEN 'waiting'
        WHEN 'in_progress' THEN 'active'
        WHEN 'done' THEN 'done'
        WHEN 'void' THEN 'void'
        ELSE NEW.status_family
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_issue_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.issue_number IS NULL OR NEW.issue_number = '' THEN
    NEW.issue_number := next_issue_number(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_po_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := next_po_number(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_repair_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.repair_number IS NULL OR NEW.repair_number = '' THEN
    NEW.repair_number := next_repair_number(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

