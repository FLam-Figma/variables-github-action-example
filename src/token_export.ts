import { GetLocalVariablesResponse, LocalVariable } from '@figma/rest-api-spec'
import { rgbToHex } from './color.js'
import { Token, TokensFile } from './token_types.js'

function tokenTypeFromVariable(variable: LocalVariable) {
  switch (variable.resolvedType) {
    case 'BOOLEAN':
      return 'boolean'
    case 'COLOR':
      return 'color'
    case 'FLOAT':
      return 'number'
    case 'STRING':
      return 'string'
  }
}

function tokenValueFromVariable(
  variable: LocalVariable,
  modeId: string,
  localVariables: { [id: string]: LocalVariable },
) {
  const value = variable.valuesByMode[modeId]
  if (typeof value === 'object') {
    if ('type' in value && value.type === 'VARIABLE_ALIAS' && typeof localVariables[value.id] !== 'undefined') {
      const aliasedVariable = localVariables[value.id]
      return `{${aliasedVariable.name.replace(/\//g, '.')}}`
    } else if ('r' in value) {
      return rgbToHex(value)
    }
    return "noName"
  } else {
    return value
  }
}

export function tokenFilesFromLocalVariables(localVariablesResponse: GetLocalVariablesResponse) {
  const tokenFiles: { [fileName: string]: TokensFile } = {}
  const localVariableCollections = localVariablesResponse.meta.variableCollections
  const localVariables = localVariablesResponse.meta.variables

  Object.values(localVariables).forEach((variable) => {
    // Skip remote variables because we only want to generate tokens for local variables
    if (variable.remote) {
      return
    }

    const collection = localVariableCollections[variable.variableCollectionId]

    collection.modes.forEach((mode) => {
      const fileName = `${collection.name}.${mode.name}.json`

      if (!tokenFiles[fileName]) {
        tokenFiles[fileName] = {}
      }

      let obj: any = tokenFiles[fileName]

      variable.name.split('/').forEach((groupName) => {
        obj[groupName] = obj[groupName] || {}
        obj = obj[groupName]
      })

      const token: Token = {
        $type: tokenTypeFromVariable(variable),
        $value: tokenValueFromVariable(variable, mode.modeId, localVariables),
        $description: variable.description,
        $extensions: {
          'com.figma': {
            hiddenFromPublishing: variable.hiddenFromPublishing,
            scopes: variable.scopes,
            codeSyntax: variable.codeSyntax,
          },
        },
      }

      Object.assign(obj, token)
    })
  })

  return tokenFiles
}
