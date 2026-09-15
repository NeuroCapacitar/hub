ALTER TABLE "modules" ADD CONSTRAINT "modules_id_course_publication_unique" UNIQUE("id","course_publication_id");--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_course_publication_fk" FOREIGN KEY ("module_id","course_publication_id") REFERENCES "public"."modules"("id","course_publication_id") ON DELETE cascade ON UPDATE no action;
