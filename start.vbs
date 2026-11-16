Option Explicit

Dim shell, fso, here, pythonExe, ready, i, http, stamp, port, baseUrl
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
pythonExe = here & "\runtime\pythonw.exe"
port = shell.ExpandEnvironmentStrings("%PANDA_PORT%")
If port = "%PANDA_PORT%" Then port = "8765"
baseUrl = "http://127.0.0.1:" & port

If Not fso.FileExists(pythonExe) Then
  MsgBox "The bundled Python runtime is missing. Please reinstall scrcpy Web.", 16, "scrcpy Web"
  WScript.Quit 1
End If

shell.Run Chr(34) & pythonExe & Chr(34) & " " & Chr(34) & here & "\serve.py" & Chr(34), 0, False

ready = False
On Error Resume Next
For i = 1 To 50
  Err.Clear
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", baseUrl & "/api/status?t=" & CStr(i), False
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then ready = True
  End If
  Set http = Nothing
  If ready Then Exit For
  WScript.Sleep 200
Next
On Error GoTo 0

If Not ready Then
  MsgBox "The local service did not start. Check whether port " & port & " is available.", 16, "scrcpy Web"
  WScript.Quit 1
End If

stamp = CStr(Int(Timer * 1000))
shell.Run baseUrl & "/control.html?t=" & stamp, 0, False
