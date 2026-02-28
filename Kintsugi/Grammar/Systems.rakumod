use Kintsugi::Grammar::Core;

grammar Kintsugi::Grammar::Systems is Kintsugi::Grammar::Core {
    rule header { 'Kintsugi/Systems' <.ws> <block> }

    token datatype:sym<string> { <string> }
    token datatype:sym<logic> { <logic> }
    # token datatype:sym<tag> { <tag> }
    token datatype:sym<url> { <url> }
    token datatype:sym<email> { <email> }

    token string { '"' ~ '"' <string-contents> }
    token logic { < true false > }
    # token tag { '<' <-[>]>+ '>' }
    token url { <[a..z]>+ '://' <[\w\-./~:?#\[\]@!$&()*+,;=%]>+ }
    token email { <[\w.\-]>+ '@' <[\w.\-]>+ }
}
