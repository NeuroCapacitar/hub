import Link from "next/link";
import type { JmvstreamUploadAsset } from "@/components/jmvstream-upload-panel";
import { LessonRichTextRenderer } from "@/components/lesson-rich-text-renderer";
import { LessonVideoEditorPreview } from "@/components/lesson-video-editor-preview";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { resolveLessonVideoPreviewUrl } from "@/features/admin/lesson-video-form";
import type { AdminLesson } from "@/features/admin/server";
import { getCourseContentStatusPresentation } from "@/features/admin/status-presentation";
import type { LessonResource } from "@/features/courses/lesson-content";
import { parseLessonContent } from "@/features/courses/lesson-content";
import {
  formatResourceFileSize,
  getResourceTypeLabel,
} from "@/features/courses/resource-presentation";
import { formatLessonDuration } from "@/features/videos/jmvstream";

export function LessonReadOnlySidebar({
  lesson,
}: {
  lesson: AdminLesson;
}): React.JSX.Element {
  const status = getCourseContentStatusPresentation(lesson.status);

  return (
    <div className="custom-scrollbar px-4 py-6 lg:flex-1 lg:overflow-y-auto lg:px-5 lg:pb-8">
      <div className="mb-6">
        <p className="type-meta">Modo consulta</p>
        <h2 className="type-card-title mt-1">Informações da aula</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Esta conta pode consultar o conteúdo, mas não pode alterá-lo.
        </p>
      </div>

      <dl className="grid gap-5">
        <ReadOnlyValue label="Título" value={lesson.title} />
        <ReadOnlyValue
          label="Descrição"
          value={lesson.description || "Sem descrição definida"}
        />
        <ReadOnlyValue
          label="Duração"
          value={formatLessonDuration(lesson.durationSeconds)}
        />
        <ReadOnlyValue
          label="Conclusão"
          value={lesson.isRequired ? "Obrigatória" : "Opcional"}
        />
        <div className="grid gap-1">
          <dt className="type-meta text-muted-foreground">Status</dt>
          <dd>
            <Badge variant={status.variant}>{status.label}</Badge>
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function LessonReadOnlyContent({
  asset,
  lesson,
  resources,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  lesson: AdminLesson;
  resources: LessonResource[];
}): React.JSX.Element {
  const content = parseLessonContent(lesson.contentJson);
  const previewUrl = resolveLessonVideoPreviewUrl({
    savedEmbedUrl: lesson.videoEmbedUrl,
    shouldRemoveVideo: false,
    submittedEmbedUrl: null,
  });
  const videoProcessing =
    Boolean(lesson.videoExternalId) &&
    (asset?.uploadStatus === "processing" ||
      asset?.uploadStatus === "uploading");
  const hasVideo = Boolean(lesson.videoExternalId || lesson.videoEmbedUrl);

  return (
    <>
      <TabsContent
        className="m-0 border-none p-0 focus-visible:ring-0"
        value="video"
      >
        {previewUrl || videoProcessing ? (
          <LessonVideoEditorPreview
            isProcessing={videoProcessing}
            previewUrl={previewUrl}
            title={lesson.title}
          />
        ) : (
          <ReadOnlyStateCard
            description={
              hasVideo
                ? "Há um vídeo associado a esta aula, mas a prévia do player não está disponível no momento."
                : "Esta aula ainda não possui um vídeo associado."
            }
            title={hasVideo ? "Vídeo associado" : "Nenhum vídeo"}
          />
        )}
      </TabsContent>

      <TabsContent
        className="m-0 border-none p-0 focus-visible:ring-0"
        value="text"
      >
        {content?.type === "text" ? (
          <Card>
            <CardHeader>
              <CardTitle as="h2" variant="section">
                Texto da aula
              </CardTitle>
              <CardDescription>
                Conteúdo disponível para consulta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-[68ch] text-base leading-8">
                <LessonRichTextRenderer document={content.document} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <ReadOnlyStateCard
            description="Esta aula ainda não possui conteúdo de texto configurado."
            title="Nenhum texto"
          />
        )}
      </TabsContent>

      <TabsContent
        className="m-0 border-none p-0 focus-visible:ring-0"
        value="attachments"
      >
        <ReadOnlyResources resources={resources} />
      </TabsContent>
    </>
  );
}

function ReadOnlyResources({
  resources,
}: {
  resources: LessonResource[];
}): React.JSX.Element {
  if (resources.length === 0) {
    return (
      <ReadOnlyStateCard
        description="Esta aula ainda não possui materiais complementares."
        title="Nenhum anexo"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" variant="section">
          Materiais complementares
        </CardTitle>
        <CardDescription>
          {resources.length} {resources.length === 1 ? "material" : "materiais"}{" "}
          disponíveis para consulta.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {resources.map((resource) => {
          const details =
            resource.storage === "r2"
              ? getResourceTypeLabel(resource, {
                  presentationLabel: "Apresentação",
                }) +
                " · " +
                formatResourceFileSize(resource.sizeBytes)
              : "Link externo";
          const content = (
            <>
              <p className="min-w-0 break-words font-medium text-sm">
                {resource.label}
              </p>
              <p className="mt-1 text-muted-foreground text-xs">{details}</p>
            </>
          );

          return resource.storage === "external" ? (
            <Link
              className="rounded-lg border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
              href={resource.url}
              key={resource.id}
              rel="noopener noreferrer"
              target="_blank"
            >
              {content}
            </Link>
          ) : (
            <div
              className="rounded-lg border bg-muted/20 px-4 py-3"
              key={resource.id}
            >
              {content}
              <p className="mt-2 text-muted-foreground text-xs">
                Arquivo protegido no Hub.
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ReadOnlyStateCard({
  description,
  title,
}: {
  description: string;
  title: string;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" variant="section">
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function ReadOnlyValue({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="grid gap-1">
      <dt className="type-meta text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{value}</dd>
    </div>
  );
}
