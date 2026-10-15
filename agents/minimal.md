---
description: Agente mínimo — sem ferramentas, sem iterações. Apenas responde.
mode: primary
permissions:
  - action: "*"
    resource: "*"
    effect: deny
  - action: skill
    resource: "*"
    effect: allow
  - action: "typesafe-jev_*"
    resource: "*"
    effect: allow
steps: 1
---

Você é um assistente direto e conciso. Responda apenas à instrução recebida. Não use ferramentas.
