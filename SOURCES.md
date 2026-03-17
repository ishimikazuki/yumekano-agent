# Sources and Design Implications

This file lists the main research and docs used for the architecture decisions.

## Mastra / framework

1. **Mastra overview**  
   https://mastra.ai/  
   Why it matters: confirms Mastra is positioned as an all-in-one TypeScript framework for agents, workflows, memory, evals, and tracing.

2. **Mastra Next.js guide**  
   https://mastra.ai/guides/getting-started/next-js  
   Why it matters: supports the single-app MVP architecture.

3. **Mastra workflows overview**  
   https://mastra.ai/docs/workflows/overview  
   Why it matters: justifies workflow-first orchestration instead of monolithic agents.

4. **Mastra suspend/resume**  
   https://mastra.ai/docs/workflows/suspend-and-resume  
   Why it matters: useful for future HITL / long-running memory jobs.

5. **Mastra memory overview**  
   https://mastra.ai/docs/memory/overview  
   Why it matters: confirms message history, working memory, semantic recall, and observational memory as first-class primitives.

6. **Mastra working memory**  
   https://mastra.ai/docs/memory/working-memory  
   Why it matters: supports schema-based structured working memory and resource/thread scopes.

7. **Mastra observational memory**  
   https://mastra.ai/docs/memory/observational-memory  
   Why it matters: inspires observation/reflection compression; also warns that resource scope is experimental.

8. **Mastra scorers / evals**  
   https://mastra.ai/docs/evals/overview  
   https://mastra.ai/docs/evals/built-in-scorers  
   Why it matters: supports automated, repeatable quality measurement.

9. **Mastra datasets**  
   https://mastra.ai/docs/observability/datasets/overview  
   Why it matters: supports versioned scenario sets for experiments.

10. **Mastra models routing**  
    https://mastra.ai/models  
    Why it matters: justifies provider/model abstraction from day 1.

11. **Mastra libSQL storage / vector**  
    https://mastra.ai/reference/storage/libsql  
    https://mastra.ai/reference/vectors/libsql  
    Why it matters: supports cheap MVP storage and semantic recall without immediately adding another database.

## Provider / xAI

12. **xAI overview**  
    https://docs.x.ai/overview  
    Why it matters: confirms current flagship capabilities, large context window, tools, and structured outputs.

13. **xAI structured outputs**  
    https://docs.x.ai/developers/model-capabilities/text/structured-outputs  
    Why it matters: planner / extractor / ranker should use structured outputs.

14. **xAI tools overview**  
    https://docs.x.ai/developers/tools/overview  
    Why it matters: confirms function calling / tool calling path.

15. **xAI models and pricing**  
    https://docs.x.ai/developers/models  
    Why it matters: confirms Grok 4 is a reasoning model and explains tool / batch pricing caveats.

16. **xAI API security FAQ**  
    https://docs.x.ai/developers/faq/security  
    Why it matters: confirms no training without explicit permission and 30-day API retention for abuse/misuse auditing.

17. **xAI acceptable use policy**  
    https://x.ai/legal/acceptable-use-policy  
    Why it matters: informs provider-boundary constraints and why provider choice is also a policy decision.

## Long-term memory research

18. **LoCoMo**  
    https://snap-research.github.io/locomo/  
    Why it matters: benchmark for very long conversational memory.

19. **LongMemEval (ICLR 2025)**  
    https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html  
    Why it matters: frames long-term memory as information extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention.

20. **LOCCO (ACL 2025 Findings)**  
    https://aclanthology.org/2025.findings-acl.1014/  
    Why it matters: shows memory decays over time and that naive rehearsal is not enough.

21. **MemBench (ACL 2025 Findings)**  
    https://aclanthology.org/2025.findings-acl.989/  
    Why it matters: distinguishes factual memory and reflective memory and evaluates effectiveness, efficiency, and capacity.

22. **Memory in the Age of AI Agents (2026 survey)**  
    https://arxiv.org/abs/2512.13564  
    Why it matters: argues that long/short-term is too coarse and proposes forms/functions/dynamics as a better taxonomy.

23. **A-MEM: Agentic Memory for LLM Agents**  
    https://arxiv.org/abs/2502.12110  
    Why it matters: supports linked, evolving memory structures and dynamic indexing.

24. **How Memory Management Impacts LLM Agents**  
    https://arxiv.org/abs/2505.16067  
    Why it matters: highlights error propagation and the need to regulate memory quality.

25. **MemoryAgentBench**  
    https://arxiv.org/abs/2507.05257  
    Why it matters: adds accurate retrieval, test-time learning, long-range understanding, and selective forgetting as core competencies.

## Emotion / affect research

26. **AppraisePLM / affect flow (CoNLL 2025)**  
    https://aclanthology.org/2025.conll-1.16/  
    Why it matters: appraisal dimensions are promising for conversational affect modeling and affect flow.

27. **Chain-of-Emotion architecture (PLOS One 2024)**  
    https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0301033  
    Why it matters: appraisal-prompting improved believability and perceived emotional intelligence in a game-agent context.

28. **EmotionBench / NeurIPS 2024**  
    https://arxiv.org/abs/2308.03656  
    Why it matters: appraisal-based benchmark for emotional alignment with human norms.

29. **EMO-Reasoning (ASRU 2025)**  
    https://arxiv.org/abs/2508.17623  
    Why it matters: emphasizes cross-turn emotional coherence and transition scoring.

## Sycophancy / realism

30. **ELEPHANT: social sycophancy in LLMs**  
    https://arxiv.org/abs/2505.13995  
    Why it matters: broadens sycophancy beyond simple factual agreement and shows models preserve user face more than humans.

31. **SYCON Bench / multi-turn sycophancy**  
    https://aclanthology.org/2025.findings-emnlp.121/  
    Why it matters: shows sycophancy is prevalent in multi-turn dialogue and that third-person prompting can reduce it in some scenarios.

## How to use this file

Use these sources to justify:
- why memory is layered
- why memory quality labels exist
- why planning is third-person
- why emotion is appraisal-first with PAD carryover
- why provider abstraction is mandatory
- why the dashboard must expose traces and evals
