CREATE TABLE "finn_user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "finn_user_roles_email_unique" UNIQUE("email")
);
