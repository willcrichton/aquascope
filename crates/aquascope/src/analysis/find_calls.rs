use rustc_data_structures::fx::FxHashMap as HashMap;
use rustc_middle::mir::{
  visit::Visitor, Body, Location, Operand, Place, Terminator, TerminatorKind,
};
use rustc_span::Span;

pub trait FindCalls<'tcx> {
  fn find_calls(&self) -> HashMap<Location, CallInfo<'tcx>>;
}

pub struct CallInfo<'tcx> {
  pub receiver_place: Place<'tcx>,
  pub fn_span: Span,
}

struct CallFinder<'tcx> {
  call_node_info: HashMap<Location, CallInfo<'tcx>>,
}

impl<'tcx> Visitor<'tcx> for CallFinder<'tcx> {
  fn visit_terminator(
    &mut self,
    terminator: &Terminator<'tcx>,
    location: Location,
  ) {
    log::debug!("found terminator {:?}", terminator);
    if let TerminatorKind::Call {
      func: _,
      args,
      destination: _,
      target: _,
      cleanup: _,
      from_hir_call: _,
      fn_span,
    } = &terminator.kind
    {
      if !args.is_empty() {
        let receiver_place = match &args[0] {
          Operand::Copy(p) => p,
          Operand::Move(p) => p,
          c => {
            log::warn!(
              "Cannot find place for constant {:?} ignoring method",
              c
            );
            return;
          }
        };

        // TODO: can we map calls more accurately to method calls?
        // this here is a rough approximation for demo purposes.

        log::debug!("Found method call at {:?}", location);

        self.call_node_info.insert(location, CallInfo {
          receiver_place: *receiver_place,
          fn_span: *fn_span,
        });
      }
    }
  }
}

impl<'tcx> FindCalls<'tcx> for Body<'tcx> {
  fn find_calls(&self) -> HashMap<Location, CallInfo<'tcx>> {
    let mut finder = CallFinder {
      call_node_info: HashMap::default(),
    };

    log::debug!("Scraping MIR for function calls");

    finder.visit_body(self);
    finder.call_node_info
  }
}
