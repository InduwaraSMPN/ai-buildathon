{{/*
Name helpers. Standard Helm shape: the chart name, truncated to what a label
value allows, overridable both ways.
*/}}
{{- define "axioma.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "axioma.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "axioma.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Labels. `axioma.labels` takes the root context; `axioma.selectorLabels` takes a
dict of `root` and `component` so every workload selects only its own pods.
*/}}
{{- define "axioma.labels" -}}
helm.sh/chart: {{ include "axioma.chart" . }}
app.kubernetes.io/name: {{ include "axioma.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: axioma
{{- end -}}

{{- define "axioma.selectorLabels" -}}
app.kubernetes.io/name: {{ include "axioma.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "axioma.componentLabels" -}}
{{ include "axioma.labels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "axioma.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "axioma.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Object names. Kept in one place so a rename cannot drift between the object and
the reference to it.
*/}}
{{- define "axioma.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "axioma.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "axioma.postgresql.fullname" -}}
{{- printf "%s-postgresql" (include "axioma.fullname" .) -}}
{{- end -}}

{{- define "axioma.postgresql.secretName" -}}
{{- if .Values.postgresql.auth.existingSecret -}}
{{- .Values.postgresql.auth.existingSecret -}}
{{- else -}}
{{- printf "%s-postgresql" (include "axioma.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "axioma.api.fullname" -}}
{{- printf "%s-api" (include "axioma.fullname" .) -}}
{{- end -}}

{{- define "axioma.api.grpcServiceName" -}}
{{- printf "%s-api-grpc" (include "axioma.fullname" .) -}}
{{- end -}}

{{- define "axioma.api.grpcTlsSecretName" -}}
{{- if .Values.api.grpc.tls.existingSecret -}}
{{- .Values.api.grpc.tls.existingSecret -}}
{{- else -}}
{{- printf "%s-grpc-tls" (include "axioma.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/*
Subject alternative names for the generated gRPC certificate: every name the
in-cluster Service answers to, the ingress host when one is configured, and
localhost for a port-forward. Anything else a device dials has to be added
through api.grpc.tls.extraSans or the handshake fails on the name.
*/}}
{{- define "axioma.api.grpcTlsSans" -}}
{{- $service := include "axioma.api.grpcServiceName" . -}}
{{- $names := list
      $service
      (printf "%s.%s" $service .Release.Namespace)
      (printf "%s.%s.svc" $service .Release.Namespace)
      (printf "%s.%s.svc.cluster.local" $service .Release.Namespace)
      "localhost" -}}
{{- with .Values.grpcIngress.host }}{{- $names = append $names . }}{{- end -}}
{{- range .Values.api.grpc.tls.extraSans }}{{- $names = append $names . }}{{- end -}}
{{- toYaml (uniq $names) -}}
{{- end -}}

{{/*
The same list, split the way genSelfSignedCert takes it: `ips` and `dnsNames`.
An address belongs in the certificate's IP SANs and nowhere else — a client
dialling a literal address reads only those, so an address emitted as a DNS
name fails the handshake with "cannot validate certificate for 10.0.0.50
because it doesn't contain any IP SANs" no matter how the list was written.
Dotted quads and anything carrying a colon are addresses; everything else is a
name.
*/}}
{{- define "axioma.api.grpcTlsSanSplit" -}}
{{- $ips := list -}}
{{- $dnsNames := list -}}
{{- range include "axioma.api.grpcTlsSans" . | fromYamlArray -}}
{{- if or (regexMatch `^([0-9]{1,3}\.){3}[0-9]{1,3}$` .) (contains ":" .) -}}
{{- $ips = append $ips . -}}
{{- else -}}
{{- $dnsNames = append $dnsNames . -}}
{{- end -}}
{{- end -}}
{{- toYaml (dict "ips" $ips "dnsNames" $dnsNames) -}}
{{- end -}}

{{/*
The names the certificate that is actually written carries. On a first install
that is the list above. On an upgrade the certificate is reused, so the names
are the ones recorded when it was issued: current values have no bearing on a
certificate already in hand, and reading them back would claim names it does
not carry.
*/}}
{{- define "axioma.api.grpcTlsCertSans" -}}
{{- $existing := lookup "v1" "Secret" .Release.Namespace (printf "%s-grpc-tls" (include "axioma.fullname" .)) -}}
{{- $recorded := "" -}}
{{- if and $existing $existing.data (index (default dict $existing.data) "tls.crt") -}}
{{- $recorded = index (default dict $existing.metadata.annotations) "axioma.io/generated-sans" | default "" -}}
{{- end -}}
{{- if $recorded -}}
{{- toYaml (splitList "," $recorded) -}}
{{- else -}}
{{- include "axioma.api.grpcTlsSans" . -}}
{{- end -}}
{{- end -}}

{{- define "axioma.agent.fullname" -}}
{{- printf "%s-agent" (include "axioma.fullname" .) -}}
{{- end -}}

{{- define "axioma.portal.fullname" -}}
{{- printf "%s-portal" (include "axioma.fullname" .) -}}
{{- end -}}

{{- define "axioma.dashboard.fullname" -}}
{{- printf "%s-dashboard" (include "axioma.fullname" .) -}}
{{- end -}}

{{- define "axioma.web.fullname" -}}
{{- printf "%s-web" (include "axioma.fullname" .) -}}
{{- end -}}

{{/*
The namespaces the API is granted access to. Empty means the release namespace
alone, which is the conservative reading of "the namespaces it manages".
*/}}
{{- define "axioma.managedNamespaces" -}}
{{- if .Values.rbac.managedNamespaces -}}
{{- toYaml .Values.rbac.managedNamespaces -}}
{{- else -}}
{{- toYaml (list .Release.Namespace) -}}
{{- end -}}
{{- end -}}

{{/*
Image references.
*/}}
{{- define "axioma.image" -}}
{{- printf "%s:%s" .repository (.tag | toString) -}}
{{- end -}}

{{- define "axioma.imagePullSecrets" -}}
{{- with .Values.imagePullSecrets }}
imagePullSecrets:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- end -}}

{{/*
DATABASE_URL.

Four supported shapes, including one refused rather than guessed at:

  1. secrets.databaseUrl set                -> that DSN, from the chart Secret.
  2. bundled Postgres with a literal password -> composed here into the chart
                                                Secret, so the API and the
                                                migration Job read one key.
  3. bundled Postgres with an existingSecret  -> the chart cannot read that
                                                password, so it cannot compose
                                                a DSN. Set secrets.databaseUrl
                                                as well.
  4. no bundled Postgres and no DSN           -> nothing to connect to.
*/}}
{{- define "axioma.databaseUrl" -}}
{{- if .Values.secrets.databaseUrl -}}
{{- .Values.secrets.databaseUrl -}}
{{- else if .Values.postgresql.enabled -}}
{{- if .Values.postgresql.auth.existingSecret -}}
{{- fail "postgresql.auth.existingSecret is set, so the chart cannot compose a DSN. Set secrets.databaseUrl (or secrets.existingSecret) to the full postgresql:// URL as well." -}}
{{- else if not .Values.postgresql.auth.password -}}
{{- fail "postgresql.auth.password is empty. Set it, or set secrets.databaseUrl to point at a database you operate." -}}
{{- else -}}
{{- printf "postgresql://%s:%s@%s:%v/%s" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "axioma.postgresql.fullname" .) .Values.postgresql.service.port .Values.postgresql.auth.database -}}
{{- end -}}
{{- else -}}
{{- fail "No database configured: either enable the bundled postgresql or set secrets.databaseUrl / secrets.existingSecret." -}}
{{- end -}}
{{- end -}}

{{/*
Environment for the API container. Every variable in api/src/env.ts appears
here, plus the three the code reads straight off process.env
(AXIOMA_GRPC_ADDRESS, AXIOMA_DOCUMENT_DIR, SKIP_ENV_VALIDATION is deliberately
never set).
*/}}
{{- define "axioma.api.env" -}}
- name: NODE_ENV
  value: {{ .Values.api.config.nodeEnv | quote }}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "axioma.secretName" . }}
      key: DATABASE_URL
- name: BETTER_AUTH_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ include "axioma.secretName" . }}
      key: BETTER_AUTH_SECRET
- name: BETTER_AUTH_URL
  value: {{ .Values.api.config.betterAuthUrl | quote }}
- name: CORS_ORIGIN
  value: {{ .Values.api.config.corsOrigin | quote }}
- name: AXIOMA_AUTO_DISPATCH
  value: {{ .Values.api.config.autoDispatch | toString | quote }}
- name: PORT
  value: {{ .Values.api.config.port | toString | quote }}
- name: DATABASE_POOL_MAX
  value: {{ .Values.api.config.databasePoolMax | toString | quote }}
{{- if or .Values.secrets.existingSecret .Values.secrets.agentToken }}
- name: AXIOMA_AGENT_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ include "axioma.secretName" . }}
      key: AXIOMA_AGENT_TOKEN
      optional: true
{{- end }}
{{- with .Values.rbac.managedNamespaces }}
- name: AXIOMA_K8S_NAMESPACES
  value: {{ join "," . | quote }}
{{- end }}
- name: AXIOMA_GRPC_ADDRESS
  value: {{ .Values.api.config.grpcAddress | quote }}
- name: AXIOMA_DOCUMENT_DIR
  value: {{ .Values.api.config.documentDir | quote }}
- name: AXIOMA_GRPC_TLS_CERT
  value: /etc/axioma/grpc-tls/tls.crt
- name: AXIOMA_GRPC_TLS_KEY
  value: /etc/axioma/grpc-tls/tls.key
- name: AXIOMA_DIRECTORY_STAFF_ATTRIBUTE
  value: {{ .Values.api.config.directory.staffAttribute | quote }}
- name: AXIOMA_DIRECTORY_STAFF_VALUE
  value: {{ .Values.api.config.directory.staffValue | quote }}
{{/*
The embeddings provider. A credential without an endpoint would silently fall
back to the endpoint baked into api/src/env.ts, so that combination is refused
rather than rendered. With no credential the API never reaches the endpoint —
createEmbedding returns null and retrieval stays lexical — so leaving all three
empty is a legitimate way to install.
*/}}
{{- if and (or .Values.secrets.embeddingKey .Values.secrets.llmKey .Values.secrets.existingSecret) (not .Values.api.config.llm.apiBase) }}
{{- fail "An embeddings credential is set but api.config.llm.apiBase is empty, which would fall back to the endpoint compiled into the API. Set the endpoint, or clear secrets.embeddingKey and secrets.llmKey to leave knowledge retrieval lexical." }}
{{- end }}
{{- if and .Values.api.config.llm.apiBase (not .Values.api.config.llm.embeddingModel) }}
{{- fail "api.config.llm.apiBase is set but api.config.llm.embeddingModel is empty. Name the model the endpoint serves — it must return 1536 dimensions or the API discards the result." }}
{{- end }}
{{- with .Values.api.config.llm.apiBase }}
- name: AXIOMA_LLM_API_BASE
  value: {{ . | quote }}
{{- end }}
{{- with .Values.api.config.llm.embeddingModel }}
- name: AXIOMA_EMBEDDING_MODEL
  value: {{ . | quote }}
{{- end }}
{{/*
Embeddings may come from a different provider than chat, and often must: a
gateway credential is commonly scoped to a list of chat models and answers
/embeddings with a 403. Setting embeddingApiBase points only the embedding call
elsewhere; the API falls back to llm.apiBase when it is empty, so an existing
single-provider install is unaffected. embeddingDimensions is for models whose
native width is not the 1536 the search_documents column is built for and which
implement Matryoshka truncation; leave it empty for a natively-1536 model.
*/}}
{{- with .Values.api.config.llm.embeddingApiBase }}
- name: AXIOMA_EMBEDDING_API_BASE
  value: {{ . | quote }}
{{- end }}
{{- if .Values.api.config.llm.embeddingDimensions }}
- name: AXIOMA_EMBEDDING_DIMENSIONS
  value: {{ .Values.api.config.llm.embeddingDimensions | toString | quote }}
{{- end }}
{{/*
A separate embeddings endpoint needs its own credential, otherwise the chat
key is sent to a provider that will not recognise it. Refused rather than
rendered, for the same reason the endpoint check above is.
*/}}
{{- if and .Values.api.config.llm.embeddingApiBase (not (or .Values.secrets.embeddingKey .Values.secrets.existingSecret)) }}
{{- fail "api.config.llm.embeddingApiBase is set but secrets.embeddingKey is empty. A separate embeddings endpoint needs its own credential; set secrets.embeddingKey, or clear embeddingApiBase to use the chat provider for both." }}
{{- end }}
{{/*
Emitted whenever the credential exists, not only alongside a separate endpoint.
secrets.embeddingKey is written into the Secret on its own, and gating the
variable on embeddingApiBase left it there unread: the API fell back to the
chat key, sent it to the embeddings endpoint, and took a 403 that shows up only
as retrieval quietly staying lexical. The API's own fallback — embedding key,
then chat key — is what decides which credential is used, so passing it through
whenever it is set is both sufficient and the documented behaviour.
*/}}
{{- if or .Values.secrets.embeddingKey .Values.secrets.existingSecret }}
- name: AXIOMA_EMBEDDING_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "axioma.secretName" . }}
      key: AXIOMA_EMBEDDING_KEY
      optional: true
{{- end }}
{{/*
The intake composer uses the same chat provider slot (llm.apiBase + the shared
credential) and the same OpenAI-shaped request format. Each value is optional:
leaving one unset lets the default compiled into api/src/env.ts take over.
*/}}
{{- $intake := .Values.api.config.intake | default dict }}
{{- with $intake.model }}
- name: AXIOMA_INTAKE_MODEL
  value: {{ . | quote }}
{{- end }}
{{/*
AXIOMA_INTAKE_VISION is validated in api/src/env.ts as the literal string "true"
or "false", so any other spelling crashloops the API on boot with a zod error. A
values file may reasonably write `yes` or `1`, so collapse whatever was given to
a real boolean here rather than passing it straight through: everything Helm
treats as empty (false, 0, "", null) is off, the string "false" is off, and
every other value is on.
*/}}
{{- if hasKey $intake "vision" }}
{{- $visionOn := and (not (empty $intake.vision)) (ne (lower (toString $intake.vision)) "false") }}
- name: AXIOMA_INTAKE_VISION
  value: {{ ternary "true" "false" $visionOn | quote }}
{{- end }}
{{/*
`hasKey` rather than `with` on the three numbers below. `with` is falsy on 0, so
it would silently drop a 0 an operator set deliberately instead of passing it
through to the API, which is the same trap the vision block above avoids.
*/}}
{{- if hasKey $intake "timeoutMs" }}
- name: AXIOMA_INTAKE_TIMEOUT_MS
  value: {{ $intake.timeoutMs | toString | quote }}
{{- end }}
{{- if hasKey $intake "maxTurns" }}
- name: AXIOMA_INTAKE_MAX_TURNS
  value: {{ $intake.maxTurns | toString | quote }}
{{- end }}
{{- if hasKey $intake "draftTtlHours" }}
- name: AXIOMA_INTAKE_DRAFT_TTL_HOURS
  value: {{ $intake.draftTtlHours | toString | quote }}
{{- end }}
{{/*
AXIOMA_LLM_KEY is now the API's *chat* credential — intake sends the employee's
conversation with it — and AXIOMA_EMBEDDING_KEY, emitted above, is the
embeddings one. Before intake existed the API only ever used this variable for
embeddings, so the chart mapped it to secrets.embeddingKey when that was set;
keeping that would now send the embeddings credential to the chat endpoint.
secrets.llmKey is therefore preferred, and the embeddings credential is only
used as a fallback when it is the sole credential configured — which is exactly
the single-provider install the old mapping was written for.
*/}}
{{- if or .Values.secrets.existingSecret .Values.secrets.embeddingKey .Values.secrets.llmKey }}
- name: AXIOMA_LLM_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "axioma.secretName" . }}
      key: {{ if or .Values.secrets.llmKey .Values.secrets.existingSecret }}AXIOMA_LLM_KEY{{ else }}AXIOMA_EMBEDDING_KEY{{ end }}
      optional: true
{{- end }}
{{- if .Values.api.config.bootstrapAdminEmail }}
- name: AXIOMA_BOOTSTRAP_ADMIN_EMAIL
  value: {{ .Values.api.config.bootstrapAdminEmail | quote }}
{{- end }}
{{- if .Values.api.config.mail.outboundUrl }}
- name: AXIOMA_MAIL_OUTBOUND_URL
  value: {{ .Values.api.config.mail.outboundUrl | quote }}
{{- end }}
{{- if .Values.api.config.directory.sourceUrl }}
- name: AXIOMA_DIRECTORY_SOURCE_URL
  value: {{ .Values.api.config.directory.sourceUrl | quote }}
{{- end }}
{{- if or .Values.secrets.existingSecret .Values.secrets.providerEncryptionKey }}
- name: AXIOMA_PROVIDER_ENCRYPTION_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "axioma.secretName" . }}
      key: AXIOMA_PROVIDER_ENCRYPTION_KEY
      optional: true
{{- end }}
{{- if or .Values.secrets.existingSecret .Values.secrets.mailOutboundToken }}
- name: AXIOMA_MAIL_OUTBOUND_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ include "axioma.secretName" . }}
      key: AXIOMA_MAIL_OUTBOUND_TOKEN
      optional: true
{{- end }}
{{- if or (and .Values.secrets.existingSecret .Values.api.config.mail.inboundEnabled) .Values.secrets.mailInboundToken }}
- name: AXIOMA_MAIL_INBOUND_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ include "axioma.secretName" . }}
      key: AXIOMA_MAIL_INBOUND_TOKEN
      optional: true
{{- end }}
{{- if or .Values.secrets.existingSecret .Values.secrets.directorySourceToken }}
- name: AXIOMA_DIRECTORY_SOURCE_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ include "axioma.secretName" . }}
      key: AXIOMA_DIRECTORY_SOURCE_TOKEN
      optional: true
{{- end }}
{{- if eq .Values.api.cluster.mode "kubeconfig" }}
- name: KUBECONFIG
  value: {{ printf "/etc/axioma/kubeconfig/%s" .Values.api.cluster.kubeconfig.key | quote }}
{{- end }}
{{/*
Only in kubeconfig mode. The Kubernetes client calls setCurrentContext with this
value whatever the mode, and an in-cluster config has exactly one context named
inClusterContext — so a context name left over from a previous kubeconfig-mode
release turns every cluster call into "No active cluster!".
*/}}
{{- if and (eq .Values.api.cluster.mode "kubeconfig") .Values.api.cluster.kubeconfig.context }}
- name: AXIOMA_K8S_CONTEXT
  value: {{ .Values.api.cluster.kubeconfig.context | quote }}
{{- end }}
{{- with .Values.api.extraEnv }}
{{ toYaml . | trim }}
{{- end }}
{{- end -}}
