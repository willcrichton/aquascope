import * as Ed from "./editor";
import {
  BackendResult,
  BackendError,
  BackendOutput,
  PermissionsOutput,
} from "./types";

const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = "8008";

export let globals: {
  editor: Ed.Editor;
};

type Result<T> = { Ok: T } | { Err: BackendError };

// XXX this extra server response type is really
// annoying and I'd like to get rid of it. This change would
// require modifying how command output is read from the spawned
// docker container on the backend.
type ServerResponse = {
  success: boolean;
  stdout: string;
  stderr: string;
};

const receiver_types_field = Ed.rwd_permissions_field;

window.onload = async () => {
  const show_rcvr_types_toggle = document.getElementById(
    "show_receiver_types"
  ) as HTMLInputElement | null;
  // Keybindings should provide more than VIM or nothing so this should be a dropdown.
  const vim_keybinding_toggle = document.getElementById(
    "vim_keybindings"
  ) as HTMLInputElement | null;
  const editor_element = document.getElementById(
    "editor"
  ) as HTMLElement | null;

  if (
    show_rcvr_types_toggle == null ||
    editor_element == null ||
    vim_keybinding_toggle == null
  ) {
    throw new Error(
      "document elements cannot be null (TODO there must be a better way to handle this)"
    );
  }

  globals = {
    editor: new Ed.Editor(editor_element, [receiver_types_field.state_field]),
  };

  vim_keybinding_toggle.addEventListener("click", (e: Event) => {
    globals.editor.toggle_vim(vim_keybinding_toggle?.checked);
  });

  show_rcvr_types_toggle.addEventListener("click", (e: Event) => {
    globals.editor.toggle_readonly(show_rcvr_types_toggle?.checked);
    if (show_rcvr_types_toggle.checked) {
      return refresh_receiver_vis();
    }

    return globals.editor.remove_icon_field(receiver_types_field);
  });
};

async function refresh_receiver_vis() {
  let output = await get_receiver_types();
  if (output.type === "output") {
    console.log("output is successful");
    console.log(output.value);
    return globals.editor.add_call_types_field(
      receiver_types_field,
      output.value
    );
  } else {
    console.log(output);
    alert("An error occurred check your logs");
    return;
  }
}

function get_receiver_types(): Promise<BackendResult<PermissionsOutput>> {
  let code_in_editor = globals.editor.get_current_contents();
  return fetch(`http://${SERVER_HOST}:${SERVER_PORT}/receiver-types`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: code_in_editor,
    }),
  })
    .then((response) => response.json())
    .then((data: ServerResponse) => {
      if (data.success) {
        let out: Result<PermissionsOutput> = JSON.parse(data.stdout);
        if ("Ok" in out) {
          console.log(`Stderr: ${data.stderr}`);
          return {
            type: "output",
            value: out.Ok,
          };
        } else {
          return out.Err;
        }
      } else {
        return {
          type: "BuildError",
          error: data.stderr,
        };
      }
    });
}
