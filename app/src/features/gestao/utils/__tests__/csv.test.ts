import { describe, it, expect } from 'vitest';
import { gerarCsv } from '../csv';

describe('gerarCsv (utilitário CSV)', () => {
  it('inclui o prefixo BOM UTF-8 (\\uFEFF) no início do arquivo', () => {
    const colunas = [{ chave: 'nome', rotulo: 'Nome' }];
    const linhas = [{ nome: 'Ana' }];

    const resultado = gerarCsv(linhas, colunas);
    expect(resultado.startsWith('\uFEFF')).toBe(true);
  });

  it('separa as colunas usando ponto e vírgula (;)', () => {
    const colunas = [
      { chave: 'nome', rotulo: 'Nome do Aluno' },
      { chave: 'turma', rotulo: 'Turma' },
      { chave: 'nota', rotulo: 'Nota Média' },
    ];
    const linhas = [
      { nome: 'Carlos', turma: '7º A', nota: 8.5 },
      { nome: 'Beatriz', turma: '7º B', nota: 9.0 },
    ];

    const resultado = gerarCsv(linhas, colunas);
    const linhasCsv = resultado.replace('\uFEFF', '').split('\r\n');

    expect(linhasCsv[0]).toBe('Nome do Aluno;Turma;Nota Média');
    expect(linhasCsv[1]).toBe('Carlos;7º A;8.5');
    expect(linhasCsv[2]).toBe('Beatriz;7º B;9');
  });

  it('escapa aspas duplas dobrando-as ("") e envolvendo o campo em aspas', () => {
    const colunas = [
      { chave: 'id', rotulo: 'ID' },
      { chave: 'texto', rotulo: 'Texto com "aspas"' },
    ];
    const linhas = [
      { id: '1', texto: 'Ele disse: "Olá mundo"' },
    ];

    const resultado = gerarCsv(linhas, colunas);
    const linhasCsv = resultado.replace('\uFEFF', '').split('\r\n');

    // Cabeçalho tem aspas -> deve ser escapado
    expect(linhasCsv[0]).toBe('ID;"Texto com ""aspas"""');
    // Corpo tem aspas -> deve ser escapado
    expect(linhasCsv[1]).toBe('1;"Ele disse: ""Olá mundo"""');
  });

  it('escapa valores contendo ponto e vírgula (;) envolvendo-os em aspas', () => {
    const colunas = [
      { chave: 'item', rotulo: 'Item' },
      { chave: 'detalhe', rotulo: 'Detalhe' },
    ];
    const linhas = [
      { item: 'A', detalhe: 'Parte 1; Parte 2; Parte 3' },
    ];

    const resultado = gerarCsv(linhas, colunas);
    const linhasCsv = resultado.replace('\uFEFF', '').split('\r\n');

    expect(linhasCsv[1]).toBe('A;"Parte 1; Parte 2; Parte 3"');
  });

  it('escapa quebras de linha dentro do valor envolvendo em aspas', () => {
    const colunas = [
      { chave: 'nome', rotulo: 'Nome' },
      { chave: 'obs', rotulo: 'Observação' },
    ];
    const linhas = [
      { nome: 'Mariana', obs: 'Linha 1\nLinha 2' },
    ];

    const resultado = gerarCsv(linhas, colunas);
    expect(resultado).toContain('"Linha 1\nLinha 2"');
  });

  it('trata valores nulos ou indefinidos como vazios', () => {
    const colunas = [
      { chave: 'a', rotulo: 'Col A' },
      { chave: 'b', rotulo: 'Col B' },
      { chave: 'c', rotulo: 'Col C' },
    ];
    const linhas = [
      { a: 'Val', b: null, c: undefined },
    ];

    const resultado = gerarCsv(linhas, colunas);
    const linhasCsv = resultado.replace('\uFEFF', '').split('\r\n');

    expect(linhasCsv[1]).toBe('Val;;');
  });
});
