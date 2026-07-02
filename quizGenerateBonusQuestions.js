async function quizGenerateBonusQuestions() {
  const apiKey = localStorage.getItem("geminiApiKey");
  if (!apiKey) {
    return { success: false, error: "Clé API Gemini manquante dans les réglages." };
  }

  const models = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

  const responseSchema = {
    type: "OBJECT",
    properties: {
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            scenario: { type: "STRING" },
            correctIndex: { type: "INTEGER", description: "Doit être strictement 0 (pour Permis) ou 1 (pour Interdit)." },
            badge: { type: "STRING", description: "Doit être 'permis' si correctIndex vaut 0, ou 'interdit' si correctIndex vaut 1." },
            level: { type: "STRING", description: "Doit être 'deoraita' ou 'derabbanan'." },
            melakha: { type: "STRING" },
            source: { type: "STRING", description: "Format obligatoire: 'Choulhan Aroukh, Orah Haim, siman NNN' (remplacer NNN par le numéro)." },
            explain: { type: "STRING", description: "Texte brut explicatif, SANS AUCUN astérisque (*) ni syntaxe Markdown." },
            howto: { type: "STRING", description: "Texte brut de conseil pratique, SANS AUCUN astérisque (*) ni syntaxe Markdown." }
          },
          required: ["scenario", "correctIndex", "badge", "level", "melakha", "source", "explain", "howto"]
        }
      }
    },
    required: ["questions"]
  };

  const promptText = `
    Tu es un éminent Rav et décisionnaire expert en Halakhot de Chabbat.
    Génère un questionnaire bonus de strictement 10 questions sur les Halakhot de Chabbat.

    CONTRAINTES HALACHIQUES STRICTES :
    - Sujets autorisés : Uniquement des cas pratiques et concrets du quotidien (les 39 Melakhot, Mouktsé, Bichoul/Cuisson, Borer/Tri, Séhita, Moudre, etc.).
    - EXCLUSIONS ABSOLUES : Ne génère JAMAIS de question sur le fait de porter des objets dehors (Hotsaa), sur l'Erouv, ou sur le deuxième jour de fête (Yom Tov Chéni), car l'utilisateur réside en Israël.
    - Rigueur : Les scénarios, sources et explications doivent être d'une précision chirurgicale.

    CONTRAINTES DE TEXTE :
    - Les champs "explain" et "howto" doivent être exclusivement en texte brut.
    - Interdiction absolue d'inclure des astérisques (*), des dièses (#), ou des puces de liste Markdown (comme "- " ou "* " en début de ligne).
  `;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Nettoyage ciblé : uniquement les artefacts markdown, jamais les tirets internes aux mots
  // (ex: "au-dessus", "peut-être", "non-juif" doivent rester intacts).
  function stripMarkdown(text) {
    return String(text)
      .replace(/\*\*(.*?)\*\*/g, "$1")   // **gras**
      .replace(/\*(.*?)\*/g, "$1")       // *italique*
      .replace(/^#{1,6}\s+/gm, "")       // # Titres
      .replace(/^[\-\*]\s+/gm, "")       // - puce ou * puce en début de ligne
      .trim();
  }

  for (let i = 0; i < models.length; i++) {
    const currentModel = models[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2
          }
        })
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        const errorData = await response.json().catch(() => null);
        let delayMs = 2000;
        const details = errorData && errorData.error && errorData.error.details;
        if (details) {
          const retryInfo = details.find(d => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo");
          if (retryInfo && retryInfo.retryDelay) {
            const seconds = parseFloat(retryInfo.retryDelay);
            if (!isNaN(seconds)) delayMs = seconds * 1000;
          }
        }
        if (i < models.length - 1) {
          await sleep(delayMs);
          continue;
        }
        return { success: false, error: "Limite de requêtes atteinte (429). Aucun modèle de secours disponible." };
      }

      if (!response.ok) {
        if (i < models.length - 1) continue;
        return { success: false, error: `Erreur HTTP de l'API (${response.status}).` };
      }

      const responseData = await response.json();
      const candidate = responseData.candidates && responseData.candidates[0];
      const rawJsonText = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
      if (!rawJsonText) {
        throw new Error("Réponse vide ou bloquée par les filtres de sécurité.");
      }

      const parsedData = JSON.parse(rawJsonText);
      if (!parsedData.questions || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
        throw new Error("Format de réponse invalide reçu de l'IA.");
      }

      const timestamp = Date.now();
      const finalBonusQuestions = [];
      parsedData.questions.forEach((q, index) => {
        if (!q || typeof q.scenario !== "string" || typeof q.explain !== "string" || typeof q.howto !== "string" || typeof q.source !== "string" || typeof q.melakha !== "string") {
          return; // on ignore juste cette question mal formée, sans faire échouer tout le lot
        }
        const safeCorrectIndex = q.correctIndex === 0 ? 0 : 1;
        finalBonusQuestions.push({
          id: `ia_${timestamp}_${index}`,
          scenario: q.scenario,
          options: ["Permis", "Interdit"],
          correctIndex: safeCorrectIndex,
          badge: safeCorrectIndex === 0 ? "permis" : "interdit",
          level: q.level === "deoraita" ? "deoraita" : "derabbanan",
          melakha: q.melakha,
          source: q.source,
          explain: stripMarkdown(q.explain),
          howto: stripMarkdown(q.howto)
        });
      });

      if (finalBonusQuestions.length === 0) {
        throw new Error("Aucune question exploitable reçue de l'IA.");
      }

      return { success: true, questions: finalBonusQuestions };
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn(`Échec avec le modèle ${currentModel}:`, error.message);
      if (i < models.length - 1) continue;
      return {
        success: false,
        error: error.name === "AbortError"
          ? "Le délai d'attente de l'IA a dépassé 15 secondes."
          : "Impossible de générer les questions bonus (erreur technique)."
      };
    }
  }
}
