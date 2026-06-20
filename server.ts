/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

function buildReportPrompt(context: any): string {
  const {
    period,
    totalDocs,
    volumes,
    ibscbs,
    byDocType,
    byRegime,
    inconformes,
    topCfops,
    temporal,
    companyRegime,
    purchaseProfile,
    salesProfile,
  } = context;

  let regimeStrategyInstruction = '';
  if (companyRegime === 'SIMPLES_NACIONAL' || companyRegime === 'MEI') {
    if (salesProfile.b2bRate > 40) {
      regimeStrategyInstruction = `
*ALERTA CRÍTICO DE COMPETITIVIDADE (SIMPLES NACIONAL + PERFIL B2B)*:
A empresa está classificada no Simples Nacional, mas vende substancialmente para outras empresas (Perfil B2B representou ${salesProfile.b2bRate.toFixed(1)}% das vendas).
Sob a Reforma Tributária (LC 214/2025), compradores PJ perdem o direito de creditar-se integralmente do IBS/CBS quando compram de fornecedores do Simples. Isso cria um alto risco competitivo de perda de mercado.
Analise profundamente e sugira a transição para o regime de apuração híbrido (recolher IBS/CBS por fora do Simples) ou migração total para RPA.`;
    } else {
      regimeStrategyInstruction = `
*ANÁLISE DE SIMPLES NACIONAL (PERFIL FOCADO EM CONSUMIDOR FINAL - B2C)*:
A empresa vende majoritariamente para consumidores finais (${salesProfile.b2c.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em vendas B2C).
Nesse perfil, o risco competitivo de perda de clientes corporativos é baixo. Avalie a viabilidade de permanecer no Simples Nacional tradicional e avalie se as compras de fornecedores RPA (${purchaseProfile.creditCoverageRate.toFixed(1)}% com créditos em potencial) justificam reavaliar o custo tributário global.`;
    }
  } else {
    regimeStrategyInstruction = `
*ANÁLISE PARA REGIME RPA (APURAÇÃO NORMAL)*:
A empresa opera no Lucro Real/Presumido (RPA) e realiza apuração plena do IBS/CBS.
Analise a eficiência no aproveitamento de créditos fiscais nas compras (${purchaseProfile.creditCoverageRate.toFixed(1)}% do total das compras geraram créditos).
Sugira estratégias para renegociar contratos ou trocar fornecedores do Simples por fornecedores RPA que oferecem créditos de IBS/CBS cheios.`;
  }

  return `Você é um Auditor Fiscal Inteligente sênior especialista na Reforma Tributária brasileira (Lei Complementar 214/2025). 
Sua tarefa é analisar o sumário consolidado de apuração de IBS/CBS da empresa e emitir um Dossiê Tributário completo, técnico e estratégico extremamente aprofundado, formatado em Markdown rico com tabelas para as seções quantitativas.

---
### DADOS DE APURAÇÃO DA EMPRESA:
- Período Analisado: ${period}
- Volume total de Documentos: ${totalDocs} (${volumes.inbound} Entradas / ${volumes.outbound} Saídas)
- Regime Presumido da Empresa: ${companyRegime}
- Créditos de IBS/CBS Gerados (Entradas): ${ibscbs.credito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Alíquota média s/ Compras: ${ibscbs.creditRate.toFixed(2)}%)
- Débitos de IBS/CBS Gerados (Saídas): ${ibscbs.debito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Alíquota média s/ Saídas: ${ibscbs.debitRate.toFixed(2)}%)
- Saldo RTC Apurado: ${ibscbs.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Efeito s/ Vendas: ${ibscbs.balanceRate.toFixed(2)}%)
- Documento Inconformes (RPA sem destaque de IBS/CBS): ${inconformes} itens pendentes de auditoria.

### PERFIS OPERACIONAIS:
- Perfil de Compras: ${purchaseProfile.creditCoverageRate.toFixed(1)}% das compras geraram direito a crédito (Total com créditos: ${purchaseProfile.withCredits.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / Neutras: ${purchaseProfile.neutral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).
- Regimes de Fornecedores: RPA: ${byRegime.rpa} | Simples Nacional: ${byRegime.simples} | MEI: ${byRegime.mei}
- Perfil de Vendas: B2B: ${salesProfile.b2b.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${salesProfile.b2bRate.toFixed(1)}%) | B2C: ${salesProfile.b2c.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}

### TOP CFOPS ENVOLVIDOS (Créditos/Débitos):
${topCfops.map((c: any) => `- CFOP ${c.cfop}: Créditos: ${c.credito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Débitos: ${c.debito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`).join('\n')}

### EVOLUÇÃO TEMPORAL:
${temporal.map((t: any) => `- Período ${t.label}: Créditos: ${t.credito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Débitos: ${t.debito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Saldo: ${t.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`).join('\n')}

---
### INSTRUÇÕES DE ESTRUTURA DO DOSSIÊ:
O dossiê DEVE ter exatamente nove seções claras separadas por cabeçalhos markdown:

1. **Sumário Executivo**: Visão executiva geral do cenário de transição tributária e posição líquida.
2. **Posição e Apuração RTC**: Apresente a análise matemática do saldo ponderando entre créditos obtidos nas entradas e débitos gerados nas saídas, avaliando as forças relativas de cada tributo duopolizado (IBS/CBS).
3. **Análise de Regime e Competitividade**: Insira as recomendações específicas sobre o regime da empresa conforme as regras da transição.
   ${regimeStrategyInstruction}
4. **Conformidade Fiscal e Qualidade de Fornecedores**: Analise as inconformidades com fornecedores (${inconformes} ocorrências). Comente sobre o impacto financeiro direto de um fornecedor RPA não destacar o imposto (perda sistemática de crédito).
5. **Apuração por Tipo de Documento**: Avalie a composição fiscal dividida nas categorias de documentos fiscais (${byDocType.map((d: any) => `${d.tipo} (${d.count} unidades)`).join(', ')}).
6. **Desempenho por CFOP / Operações**: Discorra sobre como o mix operacional (CFOPs identificados) dita a carga fiscal efetiva do contribuinte.
7. **Evolução Temporal e Projeção**: Interprete as variações de saldo nos períodos listados e projete tendências para o fluxo de caixa fiscal do contribuinte.
8. **Recomendações Práticas**: Forneça uma lista de 5 ações imediatas, práticas e comercialmente viáveis para o controller ou contador implementar.
9. **Conclusão**: Fecho analítico sênior com parecer sobre o nível de prontidão da organização frente à Reforma Tributária.

Escreva com sofisticação técnica tributária (você é extremamente erudito, utiliza jargões contábeis corretos tais como 'cumulatividade', 'não-cumulatividade plena', 'direito ao crédito financeiro', 'transição gradual LC 214/2025', 'DAS', 'DAS-IBS/CBS'). Use português do Brasil impecável e formal.`;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '20mb' }));

  // API Route: AI Status Check
  app.get('/api/ai/status', (req, res) => {
    const keyExists = !!process.env.GEMINI_API_KEY;
    res.json({ configured: keyExists });
  });

  // API Route: Secure server side Gemini streaming orchestrator
  app.post('/api/ai', async (req, res) => {
    try {
      const { context, model, maxTokens } = req.body;

      if (!context) {
        return res.status(400).json({ error: 'Contexto de apuração ausente.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: 'Chave de API do Gemini não configurada no servidor. Configure a variável GEMINI_API_KEY no painel de Secrets.' 
        });
      }

      const activeModel = model || 'gemini-3.5-flash';
      const prompt = buildReportPrompt(context);

      // Initialize Gemini Client
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Configure headers for Server-Sent Events (SSE) streaming response
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const stream = await ai.models.generateContentStream({
          model: activeModel,
          contents: prompt,
          config: {
            temperature: 0.3, // analytical, predictable, consistent reports
          },
        });

        // Pipe stream directly onto Express output
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } catch (geminiError: any) {
        console.error('Gemini call failure:', geminiError);
        res.write(`data: ${JSON.stringify({ error: geminiError.message || 'Falha na comunicação com o Gemini.' })}\n\n`);
        res.end();
      }
    } catch (err: any) {
      console.error('API Server failure:', err);
      res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
    }
  });

  // Vite integration middleware
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FULL-STACK] Servidor Simples Apuração RTC rodando sob http://localhost:${PORT}`);
  });
}

startServer();
