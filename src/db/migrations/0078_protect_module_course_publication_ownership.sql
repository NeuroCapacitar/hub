ALTER TABLE "course_publications" ADD CONSTRAINT "course_publications_id_course_unique" UNIQUE("id","course_id");--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_publication_course_fk" FOREIGN KEY ("course_publication_id","course_id") REFERENCES "public"."course_publications"("id","course_id") ON DELETE cascade ON UPDATE no action;
