CREATE TABLE "finn_domain_plugins" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"domain" varchar(255) NOT NULL,
	"current_version" varchar(50),
	"last_checked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finn_domain_plugins_license_product_unique" UNIQUE("license_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "finn_domain_plugins" ADD CONSTRAINT "finn_domain_plugins_license_id_finn_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."finn_licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finn_domain_plugins" ADD CONSTRAINT "finn_domain_plugins_product_id_finn_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."finn_products"("id") ON DELETE cascade ON UPDATE no action;