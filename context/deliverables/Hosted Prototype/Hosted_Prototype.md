# HOSTED PROTOTYPE

### Axiōma — live links for judges
**Team Groknetic** | **Intra-University AI Build-athon** | **IMSSA**

---

## 1. The links

No sign-in is required. Each link opens straight into a populated, signed-in view.

| Link | What it is | Open it as |
| :--- | :--- | :--- |
| **https://axioma-portal.viosu.com** | The employee portal — open a request, follow it in plain language, connect a computer | An employee who needs help |
| **https://axioma-dashboard.viosu.com** | The IT console — queue, approvals, device commands, CMDB, change, knowledge, administration | An IT analyst working the queue |
| **https://axioma.viosu.com** | The product site — what Axiōma is, the impact model, and the limits we state up front | Someone evaluating the product |

**Start with the portal**, because that is where a ticket begins, then move to the dashboard to see what IT sees for the same work.

---

## 2. What to try, in five minutes

**Portal — https://axioma-portal.viosu.com**

1. Land on **My requests**. Three requests are open, each in a different state: one in progress (`AX-1042`, a rollout stuck on `ImagePullBackOff`), one waiting on the employee (`AX-1038`), one resolved (`AX-1021`).
2. Open `AX-1042`. The employee view is deliberately plain language — *Received → Working on it → Done* — with a progress line rather than a transcript. An employee is told what is happening, not shown the tooling.
3. Press **New request** to see the intake path, and **Connect a computer** to see the device claim flow: enrolment binds a machine to the gateway, and claiming binds it to a person, which is a separate act the employee performs themselves.

**Dashboard — https://axioma-dashboard.viosu.com**

4. **Overview** carries the aggregate view: open work by priority, autonomous resolution rate, SLA and OLA attainment against business-hours calendars, and the resolution-code mix — `fixed`, `workaround`, `not_reproducible`, `duplicate`, `no_action_required`, `rejected`.
5. **Ticket queue**, then a ticket, then its **Transcript** tab — the agent's steps in order, and the read that verifies each write.
6. **Device commands** is the approval gate. Where no typed action fits, the agent proposes an exact argument vector and a named person approves it; the approver cannot be whoever started the run.
7. **Changes** shows that a cluster patch raises a standard change record with a rollback plan naming the previous image.
8. The left rail is the rest of the service-management surface — problems, knowledge, assets, licences, suppliers, request forms, ticket rules, workflows, mail, roles, ITSM connectors and environments — because the agent is a participant in a real ITSM system rather than a bolt-on to one.

---

## 3. What is live behind these links, stated plainly

**These two apps run against a mocked API. There is no agent, no cluster and no database behind them.**

Verified rather than assumed:

* Both apps serve `/config.js` with `mock: "true"`.
* Loading the portal in a browser produces **zero XHR or fetch calls to the API** — the only request off-origin is a Cloudflare analytics beacon.
* The configured API host, `axioma-api.viosu.com`, resolves to `100.123.0.1`. That is inside `100.64.0.0/10`, the RFC 6598 carrier-grade NAT range, so it is reachable on our own private network and not from the public internet.

The reason is the deployment posture rather than an unfinished build. Axiōma installs **inside the customer's own infrastructure**: it holds credentials for their cluster, opens inbound gRPC streams from employee laptops, and reads their CMDB. Exposing a working instance on a public URL would mean exposing a Kubernetes-writing agent and a device gateway to the internet, which is precisely what the architecture is built not to do.

**So the hosted links are the honest half of the deliverable: the product surface, complete and clickable.** The working loop — a ticket arriving, Axel diagnosing it, patching a deployment, verifying the patch and closing the ticket — is shown in the demo video and is reproducible from the repository.

---

## 4. What the hosted prototype does and does not evidence

| Shown here | Not shown here |
| :--- | :--- |
| Every screen of both applications, populated | A live agent run against a real cluster |
| The employee's plain-language view of a ticket | A typed action dispatched to a real laptop |
| The IT console's queue, transcript layout and evidence panes | A real model call, and the token counts a run records |
| The approval gate, the change record, the CMDB and knowledge surfaces | Live retrieval over the pgvector index |
| The information architecture of the whole service-management system | Anything that requires the API, which is not publicly reachable |

**The figures on the dashboard are demo fixtures, not measurements.** The autonomous resolution rate, CSAT, median time-to-resolution and SLA attainment shown on **Overview** are seeded values that make the screen legible. Nothing in this repository supports a performance, savings or accuracy claim, and we make none.

---

## 5. Running the real system

The repository is the deliverable that carries the working loop: **https://github.com/InduwaraSMPN/ai-buildathon**

From `axioma/`, with Docker and a Kubernetes context available:

```bash
tilt up                       # API, portal, dashboard, agent, Postgres + pgvector
cd api && pnpm seed:demo      # service-management demo data
cd api && pnpm seed           # the two cluster faults the demo scenarios use
```

That brings up the portal on `:3001` and the dashboard on `:3002` against a real API, a real agent worker and a real cluster. `axioma/README.md` carries the per-project path, the environment variables, and the gates CI runs. The three scenarios worth reproducing are the failing deployment that Axel fixes, the unschedulable pod that Axel correctly refuses to fix, and the laptop proxy fault that Axel repairs through `axel-cli`.

---

## 6. If a link does not load

| Symptom | Cause |
| :--- | :--- |
| A page renders but an action does nothing | Expected. The API is not publicly reachable; the mocked surface answers reads, not writes |
| The dashboard opens on **Overview** rather than a login screen | Also expected. The hosted build has no auth gate, because there is no session service behind it |
| A number looks too good | It is a fixture. See section 4 |
