{{/*
Both frontends are the same shape: a static bundle behind unprivileged nginx on
8080, with the API URL written into /config.js at container start. Rendered from
one definition so the two cannot drift.

Call with a dict of:
  root      — the root context
  component — "portal" or "dashboard"
  config    — .Values.portal or .Values.dashboard
  image     — .Values.images.portal or .Values.images.dashboard
  name      — the resource name
*/}}
{{- define "axioma.frontend" -}}
{{- $root := .root -}}
{{- $config := .config -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ .name }}
  namespace: {{ $root.Release.Namespace }}
  labels:
    {{- include "axioma.componentLabels" (dict "root" $root "component" .component) | nindent 4 }}
  {{- with $config.service.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  type: {{ $config.service.type }}
  ports:
    - name: http
      port: {{ $config.service.port }}
      targetPort: http
      protocol: TCP
  selector:
    {{- include "axioma.selectorLabels" (dict "root" $root "component" .component) | nindent 4 }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .name }}
  namespace: {{ $root.Release.Namespace }}
  labels:
    {{- include "axioma.componentLabels" (dict "root" $root "component" .component) | nindent 4 }}
spec:
  replicas: {{ $config.replicaCount }}
  selector:
    matchLabels:
      {{- include "axioma.selectorLabels" (dict "root" $root "component" .component) | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "axioma.selectorLabels" (dict "root" $root "component" .component) | nindent 8 }}
        {{- with $root.Values.podLabels }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      annotations:
        # /config.js is written from these values at container start, so a
        # changed URL has to roll the pods to take effect.
        checksum/runtime-config: {{ printf "%s|%s" ($config.apiUrl | toString) ($config.portalUrl | default "" | toString) | sha256sum }}
        {{- with $root.Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
    spec:
      {{- include "axioma.imagePullSecrets" $root | nindent 6 }}
      automountServiceAccountToken: false
      {{- with $config.podSecurityContext }}
      securityContext:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: {{ .component }}
          image: {{ include "axioma.image" .image }}
          imagePullPolicy: {{ .image.pullPolicy }}
          {{- with $config.containerSecurityContext }}
          securityContext:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          env:
            - name: AXIOMA_API_URL
              value: {{ $config.apiUrl | quote }}
            {{- if $config.portalUrl }}
            - name: AXIOMA_PORTAL_URL
              value: {{ $config.portalUrl | quote }}
            {{- end }}
            {{- with $config.extraEnv }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 5
            periodSeconds: 20
            timeoutSeconds: 3
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 3
            periodSeconds: 10
            timeoutSeconds: 3
          resources:
            {{- toYaml $config.resources | nindent 12 }}
      {{- with (default $root.Values.nodeSelector $config.nodeSelector) }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with (default $root.Values.tolerations $config.tolerations) }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with (default $root.Values.affinity $config.affinity) }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
{{- end -}}
