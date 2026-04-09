// Style constants matching C++ KUIDefine.h
export const STYLE_MAP = {
  'KSTYLE_NOCLOSE': 1 << 1,
  'KSTYLE_NOMINIMIZE': 1 << 2,
  'KSTYLE_NORESIZE': 1 << 3,
  'KSTYLE_NOTITLE': 1 << 4,
  'KSTYLE_NOSTATUSBAR': 1 << 5,
  'KSTYLE_VSCROLL': 1 << 6,
  'KSTYLE_HSCROLL': 1 << 7,
  'KSTYLE_NOFRAME': 1 << 8,
  'KSTYLE_NOTOPFRAME': 1 << 9,
  'KSTYLE_NOBACKGROUND': 1 << 10,
  'KSTYLE_RESIZE_LEFT': 1 << 11,
  'KSTYLE_RESIZE_TOP': 1 << 12,
  'KSTYLE_MOVE_BY_TITLEBAR': 1 << 13,
  'KSTYLE_MOVE_BY_TOPFRAME': 1 << 14,
  'KSTYLE_MOVE_BY_ALL': 1 << 15,
  'KSTYLE_MOVE_BY_CUSTOM': 1 << 16,
  'KSTYLE_NO_CLIPPING': 1 << 17,
  'KSTYLE_VERTICAL_REPEAT': 1 << 18,
  'KSTYLE_HORIZONTAL_REPEAT': 1 << 19,
  'KSTYLE_SPR_CAPTION': 1 << 20,
  'KSTYLE_ALPHA_SHOW': 1 << 21,
  // Control-specific styles (some reuse bits)
  'KSTYLE_STRETCH_VERTICAL': 1 << 1,
  'KSTYLE_BUTTON_LEFTSIDE': 1 << 1,
  'KSTYLE_BUTTON_RIGHTSIDE': 1 << 2,
  'KSTYLE_BUTTON_CANDRAG': 1 << 3,
  'KSTYLE_BUTTON_VERTICAL': 1 << 4,
  'KSTYLE_CHECK_CAPTION_RIGHT': 1 << 1,
  'KSTYLE_SB_NOLEFTSIDE': 1 << 1,
  'KSTYLE_SB_NORIGHTSIDE': 1 << 2,
  'KSTYLE_TAB_VERTICAL': 1 << 1,
  'KSTYLE_NUMBER_LEFT': 1 << 1,
  'KSTYLE_NUMBER_CENTER': 1 << 2,
  'KSTYLE_NUMBER_RIGHT': 1 << 3,
  'KSTYLE_GAUGE_WITH_GRADUATION': 1 << 1,
  'KSTYLE_MSG_VERTICAL_REPEAT': 1 << 0,
  'KSTYLE_MSG_HORIZONTAL_REPEAT': 1 << 1,
};

export const FLAG_MAP = {
  'KFLAG_NO_GET_MESSAGE': 1 << 1,
  'KFLAG_GET_PASS_MESSAGE': 1 << 2,
  'KFLAG_CAN_DRAG': 1 << 3,
  'KFLAG_SINGLE_LINE': 1 << 4,
  'KFLAG_NO_GET_FOCUS': 1 << 5,
};

export const ANCHOR_MAP = {
  'KANCHOR_LEFT': 1 << 1,
  'KANCHOR_RIGHT': 1 << 2,
  'KANCHOR_TOP': 1 << 3,
  'KANCHOR_BOTTOM': 1 << 4,
};

// GenWnd-specific styles (subset for genwnd only)
export const GENWND_STYLES = [
  'KSTYLE_NOCLOSE',
  'KSTYLE_NOMINIMIZE',
  'KSTYLE_NORESIZE',
  'KSTYLE_NOTITLE',
  'KSTYLE_NOSTATUSBAR',
  'KSTYLE_VSCROLL',
  'KSTYLE_HSCROLL',
  'KSTYLE_NOFRAME',
  'KSTYLE_NOTOPFRAME',
  'KSTYLE_NOBACKGROUND',
  'KSTYLE_RESIZE_LEFT',
  'KSTYLE_RESIZE_TOP',
  'KSTYLE_MOVE_BY_TITLEBAR',
  'KSTYLE_MOVE_BY_TOPFRAME',
  'KSTYLE_MOVE_BY_ALL',
  'KSTYLE_MOVE_BY_CUSTOM',
  'KSTYLE_NO_CLIPPING',
  'KSTYLE_VERTICAL_REPEAT',
  'KSTYLE_HORIZONTAL_REPEAT',
  'KSTYLE_SPR_CAPTION',
  'KSTYLE_ALPHA_SHOW',
];

// Common control types matching C++ factory registrations
export const CONTROL_TYPES = [
  'static',
  'button',
  'simplebutton',
  'edit',
  'check',
  'combo',
  'list',
  'gauge',
  'progress',
  'slider',
  'scroll',
  'v_scroll',
  'v_scrollEx',
  'v_scrollSmallEx',
  'h_scroll',
  'tab_head',
  'tab_simple_head',
  'tab_sheet',
  'statusbar',
  'titlebar',
  'number',
  'staticicon',
  'msg',
];

// Parse style/flag/anchor string into individual tokens
export const parseFlags = (value) => {
  if (!value) return [];
  // Split by | and clean up whitespace, filter empty
  return value.split('|').map(s => s.trim()).filter(s => s && s !== ';');
};

export const parseNui = (text) => {
  const lines = text.split(/\r?\n/);
  const objects = [];
  let currentObject = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('begin ')) {
      const type = line.substring(6).trim();
      currentObject = { type, properties: {} };
    } else if (line === 'end') {
      if (currentObject) {
        objects.push(currentObject);
        currentObject = null;
      }
    } else if (currentObject) {
      // Parse key = value;
      const eqIndex = line.indexOf('=');
      if (eqIndex !== -1) {
        const key = line.substring(0, eqIndex).trim();
        let value = line.substring(eqIndex + 1).trim();
        // Remove trailing semicolon
        if (value.endsWith(';')) {
          value = value.substring(0, value.length - 1);
        }
        // Trim trailing | from style/flag/anchor
        if (value.endsWith('|')) {
          value = value.substring(0, value.length - 1).trim();
        }
        currentObject.properties[key] = value;
      }
    }
  }

  // Separate genwnd from controls
  const genwnd = objects.find(o => o.type === 'genwnd') || { type: 'genwnd', properties: {} };
  const controls = objects.filter(o => o.type !== 'genwnd');

  return { genwnd, controls };
};

export const generateNui = (data) => {
  let output = '';

  // Helper to format style/flag/anchor with proper C++ format: " FLAG1 | FLAG2 |;"
  const formatFlagValue = (value) => {
    if (!value) return null;
    const flags = parseFlags(value);
    if (flags.length === 0) return null;
    // Format: " FLAG1 | FLAG2 |" (with leading space before each flag and trailing |)
    // Matches C++ GetFileStream output: " KSTYLE_NOCLOSE | KSTYLE_NOMINIMIZE |"
    return flags.map(f => ' ' + f + ' |').join('');
  };

  // Helper to write genwnd object (matches C++ GetFileStream)
  const writeGenWnd = (obj) => {
    output += 'begin genwnd\r\n';
    const props = obj.properties;

    // Order: id, spr, rect, style, flag, anchor (matching C++ output)
    if (props.id) {
      output += `id = ${props.id};\r\n`;
    }
    if (props.spr) {
      output += `spr = ${props.spr};\r\n`;
    }
    if (props.rect) {
      output += `rect = ${props.rect};\r\n`;
    }
    
    // Style with C++ format
    const styleValue = formatFlagValue(props.style);
    if (styleValue) {
      output += `style =${styleValue};\r\n`;
    }

    // Flag with C++ format
    const flagValue = formatFlagValue(props.flag);
    if (flagValue) {
      output += `flag =${flagValue};\r\n`;
    }

    // Anchor with C++ format (note: C++ has a bug where it outputs "style =" for anchor in genwnd)
    const anchorValue = formatFlagValue(props.anchor);
    if (anchorValue) {
      output += `anchor =${anchorValue};\r\n`;
    }

    output += 'end\r\n\r\n';
  };

  // Helper to write control object (matches C++ GetControlFileStream)
  const writeControl = (obj) => {
    output += `begin ${obj.type}\r\n`;
    const props = obj.properties;

    // Order: id, spr, ani, caption, info, rect, flag, anchor (matching C++ output)
    if (props.id) {
      output += `id = ${props.id};\r\n`;
    }
    if (props.spr) {
      output += `spr = ${props.spr};\r\n`;
    }
    // ani can be empty string
    if (props.ani !== undefined) {
      output += `ani = ${props.ani};\r\n`;
    }
    
    // Caption with quotes (C++ wraps in quotes)
    if (props.caption !== undefined && props.caption !== null && props.caption !== '') {
      // Check if caption already has quotes
      let captionVal = props.caption;
      if (!captionVal.startsWith('"')) {
        captionVal = `"${captionVal}"`;
      }
      output += `caption = ${captionVal};\r\n`;
    }
    
    // Info/tooltip
    if (props.info !== undefined && props.info !== null && props.info !== '') {
      output += `info = ${props.info};\r\n`;
    }

    if (props.rect) {
      output += `rect = ${props.rect};\r\n`;
    }

    // Flag with C++ format
    const flagValue = formatFlagValue(props.flag);
    if (flagValue) {
      output += `flag =${flagValue};\r\n`;
    }

    // Anchor with C++ format
    const anchorValue = formatFlagValue(props.anchor);
    if (anchorValue) {
      output += `anchor =${anchorValue};\r\n`;
    }

    output += 'end\r\n\r\n';
  };

  if (data.genwnd) {
    writeGenWnd(data.genwnd);
  }

  if (data.controls) {
    for (const control of data.controls) {
      writeControl(control);
    }
  }

  return output;
};
