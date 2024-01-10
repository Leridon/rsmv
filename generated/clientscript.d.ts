// GENERATED DO NOT EDIT
// This source data is located at '..\src\opcodes\clientscript.jsonc'
// run `npm run filetypes` to rebuild

export type clientscript = {
	byte0: (number|0),
	switchsize: (number|0),
	switches: {
		value: number,
		label: number,
	}[][],
	longargcount: (number|0),
	stringargcount: number,
	intargcount: number,
	locallongcount: (number|0),
	localstringcount: number,
	localintcount: number,
	instructioncount: number,
	opcodedata: {
		opcode:number,
		imm:number,
		imm_obj:number|string|[number,number]|{value:number,label:number}[]|null,
	}[],
};
