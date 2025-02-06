function OnInit(/* ScriptInitData */ data) {
  data.name = "Text_File_Encoding_column"
  data.desc = "Shows the Encoding of text files"
  data.default_enable = true
  data.config_desc = DOpus.NewMap()
  data.config.debug = false
  data.config_desc("debug") = "Print debug messages to the script log"
  data.config.extensionsWhiteList = ""
  data.config_desc("extensionsWhiteList") = "Comma separated list of file extensions (case insensitive) to process. Leave empty to process all files. Example of the list: '.txt,.html,.csv'"
  data.version = "0.0-dev"
  data.url = "https://github.com/PolarGoose/DirectoryOpus-TextFileEncoding-plugin"

  var col = data.AddColumn()
  col.name = "Encoding"
  col.method = "OnColumnDataRequested"
  col.autorefresh = true
  col.justify = "right"
}

function OnColumnDataRequested(/* ScriptColumnData */ data) {
  var filePath = data.item.realpath
  debug("OnColumnDataRequested: filePath=" + filePath)

  if (data.item.is_dir) {
    debug("Skip directory path")
    return
  }

  // If the extensionsWhiteList is defined, then we need to skip all files that do not have the right extension
  if (Script.config.extensionsWhiteList !== "") {
    if(data.item.ext === "") {
      debug("Skip file without extension")
      return
    }

    if(!ContainsCaseInsensitive(Script.config.extensionsWhiteList, data.item.ext)) {
      debug("Skip extension: " + data.item.ext)
      return
    }
  }

  try {
    data.value = getFileEncoding(filePath)
  } catch (e) {
    debug("Exception: " + e)
  }
}

function getFileEncoding(filePath) {
  var firstFileBytesBlob = readAtMostBytesFromFile(filePath, 1024)

  if(firstFileBytesBlob === null) {
    return ""
  }

  if (firstFileBytesBlob.size == 0) {
    return "Empty"
  }

  // Check for UTF-8 BOM (EF BB BF)
  if (firstFileBytesBlob.size >= 3 &&
      firstFileBytesBlob(0) === 0xEF &&
      firstFileBytesBlob(1) === 0xBB &&
      firstFileBytesBlob(2) === 0xBF) {
    return "UTF-8 BOM"
  }

  // Check for UTF-16 LE BOM (FF FE) and UTF-32 LE BOM (FF FE 00 00)
  if (firstFileBytesBlob.size >= 2 && firstFileBytesBlob(0) === 0xFF && firstFileBytesBlob(1) === 0xFE) {
    if (firstFileBytesBlob.size >= 4 && firstFileBytesBlob(2) === 0x00 && firstFileBytesBlob(3) === 0x00) {
      return "UTF-32 LE"
    }
    return "UTF-16 LE"
  }

  // Check for UTF-16 BE BOM (FE FF)
  if (firstFileBytesBlob.size >= 2 && firstFileBytesBlob(0) === 0xFE && firstFileBytesBlob(1) === 0xFF) {
    return "UTF-16 BE"
  }

  // Check for UTF-32 BE BOM (00 00 FE FF)
  if (firstFileBytesBlob.size >= 4 &&
      firstFileBytesBlob(0) === 0x00 &&
      firstFileBytesBlob(1) === 0x00 &&
      firstFileBytesBlob(2) === 0xFE &&
      firstFileBytesBlob(3) === 0xFF) {
    return "UTF-32 BE"
  }

  if (isAnsi(firstFileBytesBlob)) {
    return "ANSI"
  }

  if (isUtf8(firstFileBytesBlob)) {
    return "UTF-8"
  }

  if (isBinary(firstFileBytesBlob)) {
    return "Binary"
  }

  return "?"
}

function isAnsi(blob) {
  for (var i = 0; i < blob.size; i++) {
    if (blob(i) > 127) {
      return false
    }
  }
  return true
}

function isUtf8(blob) {
  var i = 0
  while (i < blob.size) {
    var byte = blob(i)
    if (byte < 128) {
      // ASCII (0xxxxxxx)
      i++
    } else if ((byte & 0xE0) === 0xC0) {
      // 110xxxxx 10xxxxxx : two-byte sequence.
      if (i + 1 >= blob.size || (blob(i + 1) & 0xC0) !== 0x80) {
        return false
      }
      i += 2
    } else if ((byte & 0xF0) === 0xE0) {
      // 1110xxxx 10xxxxxx 10xxxxxx : three-byte sequence.
      if (i + 2 >= blob.size ||
          (blob(i + 1) & 0xC0) !== 0x80 ||
          (blob(i + 2) & 0xC0) !== 0x80) {
        return false
      }
      i += 3
    } else if ((byte & 0xF8) === 0xF0) {
      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx : four-byte sequence.
      if (i + 3 >= blob.size ||
          (blob(i + 1) & 0xC0) !== 0x80 ||
          (blob(i + 2) & 0xC0) !== 0x80 ||
          (blob(i + 3) & 0xC0) !== 0x80) {
        return false
      }
      i += 4
    } else {
      // If the byte does not match any valid UTF-8 header, it's not UTF-8.
      return false
    }
  }
  return true
}

function isBinary(blob) {
  for (var i = 0; i < blob.size; i++) {
    if (blob(i) === 0) {
      return true
    }
  }
}

function /* Blob */ readAtMostBytesFromFile(/* Path */ filePath, maximumNumberOfBytesToRead) {
  var file = DOpus.FSUtil.OpenFile(filePath, "re")
  if (file.error) {
    return null
  }

  var blob = file.Read(maximumNumberOfBytesToRead)
  if (file.error) {
    return null
  }

  file.Close()

  return blob;
}

function ContainsCaseInsensitive(str, substr) {
  str = str.toLowerCase()
  substr = substr.toLowerCase()
  return str.indexOf(substr) !== -1
}

function debug(text) {
  if (Script.config.debug) {
    DOpus.Output(text)
  }
}
