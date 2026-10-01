// Scoped by eslint.config.js: account palettes and global token values are not audited.
const palette =
    /\b(?:bg|text|border(?:-[trblxyse])?|outline|ring(?:-offset)?|accent|from|via|to|fill|stroke|decoration|shadow|divide(?:-[xy])?|placeholder|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/;
const literalColor = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|oklab|oklch|lab|lch|color)\(/i;
const arbitrary =
    /(?:^|[\s:!])-?(?:bg|text|border(?:-[trblxyse])?|outline|ring(?:-offset)?|accent|from|via|to|fill|stroke|shadow|drop-shadow|blur|p[trblxyse]?|m[trblxyse]?|size|w|h|min-w|max-w|min-h|max-h|gap(?:-[xy])?|space-[xy]|rounded(?:-[trblse]+)?|top|right|bottom|left|inset(?:-[xy])?|translate(?:-[xyz])?|basis|leading|tracking|grid-cols|grid-rows)-\[([^\]]+)\]/g;
const namedColors = new Set(
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(
        " ",
    ),
);
function hasNamedColor(value) {
    return (
        value
            .replace(/--[\w-]+/g, "")
            .toLowerCase()
            .match(/[a-z]+/g) ?? []
    ).some((word) => namedColors.has(word));
}
const colorProperty = /color|background|fill|stroke|shadow|border|outline/i;

export default {
    meta: {
        type: "problem",
        docs: { description: "Keep timer UI on semantic color tokens and the system dimension scale" },
        schema: [],
        messages: { contract: "Timer UI must use semantic tokens and system dimensions; found {{value}}." },
    },
    create(context) {
        function check(node, value) {
            if (typeof value !== "string") return;
            const match = palette.exec(value) ?? literalColor.exec(value);
            if (match) {
                context.report({ node, messageId: "contract", data: { value: match[0] } });
                return;
            }
            for (const item of value.matchAll(arbitrary)) {
                // Explicit token references are allowed, including calculations based on token scale.
                if (/^(?:var\(--[\w-]+\)|calc\([^)]*var\(--[\w-]+\).*)$/.test(item[1]) && !/[\d.]+(?:px|rem|em|vh|vw|vmin|vmax|ch)\b/.test(item[1]) && !hasNamedColor(item[1]))
                    continue;
                context.report({ node, messageId: "contract", data: { value: item[0].trim() } });
            }
            let parent = node.parent;
            while (parent && !["Property", "JSXAttribute", "Program"].includes(parent.type)) parent = parent.parent;
            if (parent?.type === "Property") {
                const key = parent.key.name ?? parent.key.value;
                if (typeof key === "string" && colorProperty.test(key) && hasNamedColor(value)) {
                    context.report({ node, messageId: "contract", data: { value } });
                }
            }
            if (
                parent?.type === "JSXAttribute" &&
                parent.name.name === "style" &&
                value.split(";").some((declaration) => {
                    const separator = declaration.indexOf(":");
                    return separator >= 0 && colorProperty.test(declaration.slice(0, separator)) && hasNamedColor(declaration.slice(separator + 1));
                })
            ) {
                context.report({ node, messageId: "contract", data: { value } });
            }
        }
        return {
            Literal(node) {
                check(node, node.value);
            },
            TemplateElement(node) {
                check(node, node.value.raw);
            },
        };
    },
};
