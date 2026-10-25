#!/usr/bin/env node
/**
 * smip_mcp.js - Model Context Protocol (MCP) Server for SMIP
 * Provides native tools for Claude Code, Cursor, Windsurf, Cline, Antigravity, and other agents.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const server = new Server(
  {
    name: 'smip-skill-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const ROOT_DIR = path.resolve(__dirname, '..');

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'smip_search_curriculum',
        description: 'Kërkon planet mësimore (Word/PDF) në bibliotekën lokale smip_docs ose burimet e botuesve (Albas, Mediaprint, Pegi, Smiles, ASCAP).',
        inputSchema: {
          type: 'object',
          properties: {
            grade: { type: 'string', description: 'Klasa (p.sh. "6", "8", "6-8", "3")' },
            subject: { type: 'string', description: 'Lënda (p.sh. "Edukim Fizik", "Anglisht", "Qytetari")' },
            publisher: { type: 'string', description: 'Shtëpia botuese (p.sh. "Albas", "Mediaprint", "Smiles", "Pegi")' }
          }
        }
      },
      {
        name: 'smip_prepare_topics',
        description: 'Analizon skedarin Word (.docx) të planit mësimor, përjashton festat dhe pushimet zyrtare të MAS, dhe gjeneron temat ditore.',
        inputSchema: {
          type: 'object',
          required: ['file', 'grade', 'subject', 'month', 'days'],
          properties: {
            file: { type: 'string', description: 'Rruga drejt skedarit .docx (p.sh. "smip_docs/EDUKIM_FIZIK_6_Plani_me_simor_vjetor.docx")' },
            grade: { type: 'string', description: 'Emri i klasës' },
            subject: { type: 'string', description: 'Lënda mësimore' },
            month: { type: 'number', description: 'Muaji numerik (1 - 12)' },
            year: { type: 'number', default: 2026, description: 'Viti (default: 2026)' },
            days: { type: 'string', description: 'JSON string me ditët dhe orët në javë, p.sh: \'{"E Hënë": 2, "E Premte": 1}\'' },
            start_index: { type: 'number', default: 0, description: 'Indeksi i orës fillestare' }
          }
        }
      },
      {
        name: 'smip_insert_to_portal',
        description: 'Lidhet me Google Chrome (CDP ose Playwright) dhe inseron automatikisht temat e përgatitura në portalin smip.al.',
        inputSchema: {
          type: 'object',
          required: ['topics_file', 'class_name', 'subject_name', 'month'],
          properties: {
            topics_file: { type: 'string', description: 'Skedari JSON me temat e gjeneruara' },
            class_name: { type: 'string', description: 'Emri i klasës në SMIP' },
            subject_name: { type: 'string', description: 'Emri i lëndës në SMIP' },
            month: { type: 'string', description: 'Muaji në format MM/YYYY (p.sh. "10/2026")' },
            use_chrome_cdp: { type: 'boolean', default: false, description: 'Lidhu direkt me dritaren ekzistuese të Google Chrome në portën 9222' },
            headful: { type: 'boolean', default: false, description: 'Hap shfletues të dukshëm në vend të prapaskenës' },
            dry_run: { type: 'boolean', default: false, description: 'Vetëm simulo pa klikuar Ruaj Ndryshimet' }
          }
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'smip_search_curriculum') {
      const scriptPath = path.join(ROOT_DIR, 'scripts', 'find_curriculum.py');
      let cmd = `python3 "${scriptPath}"`;
      if (args.grade) cmd += ` --grade "${args.grade}"`;
      if (args.subject) cmd += ` --subject "${args.subject}"`;
      if (args.publisher) cmd += ` --publisher "${args.publisher}"`;
      
      const output = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8' });
      return { content: [{ type: 'text', text: output }] };
    }

    if (name === 'smip_prepare_topics') {
      const scriptPath = path.join(ROOT_DIR, 'scripts', 'parse_plan.py');
      const outJson = `temat_${args.grade.replace(/[^a-zA-Z0-9]/g, '_')}_${args.month}_${args.year || 2026}.json`;
      const outMd = `temat_${args.grade.replace(/[^a-zA-Z0-9]/g, '_')}_${args.month}_${args.year || 2026}.md`;

      const cmd = `python3 "${scriptPath}" --file "${args.file}" --grade "${args.grade}" --subject "${args.subject}" --month ${args.month} --year ${args.year || 2026} --days '${args.days}' --start-index ${args.start_index || 0} --output-json "${outJson}" --output-md "${outMd}"`;
      
      const output = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8' });
      const mdContent = fs.existsSync(path.join(ROOT_DIR, outMd)) ? fs.readFileSync(path.join(ROOT_DIR, outMd), 'utf-8') : '';
      return {
        content: [
          { type: 'text', text: `${output}\n\n### Pasqyra Tabelare:\n${mdContent}` }
        ]
      };
    }

    if (name === 'smip_insert_to_portal') {
      const botPath = path.join(ROOT_DIR, 'scripts', 'smip_bot.js');
      let cmd = `node "${botPath}" --topics "${args.topics_file}" --class "${args.class_name}" --subject "${args.subject_name}" --month "${args.month}"`;
      if (args.use_chrome_cdp) cmd += ' --cdp 9222';
      if (args.headful) cmd += ' --headful';
      if (args.dry_run) cmd += ' --dry-run';

      const output = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8' });
      return { content: [{ type: 'text', text: output }] };
    }

    throw new Error(`Vegla e panjohur: ${name}`);
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Gabim gjatë ekzekutimit: ${err.message}\n${err.stdout || ''}\n${err.stderr || ''}` }]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('MCP Server Error:', err);
  process.exit(1);
});
